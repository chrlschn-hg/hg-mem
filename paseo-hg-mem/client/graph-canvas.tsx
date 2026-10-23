// Interactive graph canvas. Web only: Reagraph (WebGL) from a vendored bundle. Every failure ends in
// an in-place message with Retry and a plain node list, so the Memory UI around it keeps working.
//
// What the error handling covers: module load, host/renderer React mismatch, missing WebGL, a React
// render error in our own tree, a lost WebGL context, and a start deadline. Whether an error thrown
// inside the renderer's separate React root reaches our boundary is recorded in ADAPTER.md (tested or
// not). It does not cover async errors thrown outside React (timers, promises), GPU or browser
// process crashes, or a hung main thread. No global error listeners are installed, so unrelated
// page errors are never swallowed.
import type { PluginTheme } from "@getpaseo/plugin";
import { Component, createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { checkWebGL, loadReagraph, watchCanvas, type GraphFault, type ReagraphModule } from "./graph-web";

export interface GraphCanvasNode {
  id: string;
  label: string;
  kind: string;
  status?: string;
  historical?: boolean;
  required?: boolean;
  validity?: string;
}
export interface GraphCanvasEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}
export interface GraphCanvasViewProps {
  theme: PluginTheme;
  compact: boolean;
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  selected: string | null;
  onSelect(id: string | null): void;
  /** Informational: called when the canvas enters its error state. The view renders its own message. */
  onError?(message: string): void;
  /** Show the component's own node list (default true). Pass false when the parent already lists the nodes. */
  showNodeList?: boolean;
  /** Test harness only: forces one failure path. Production callers do not pass it. */
  fault?: GraphFault;
}

export const GRAPH_CANVAS_NODE_CAP = 120;
const isWeb = Platform.OS === "web";

function luminance(color: string): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  const rgb = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(color.trim());
  const [r, g, b] = hex
    ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
    : rgb
      ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      : [0, 0, 0];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function reagraphTheme(mod: ReagraphModule, theme: PluginTheme) {
  const c = theme.colors;
  const base = (luminance(c.surface0) < 0.5 ? mod.darkTheme : mod.lightTheme) as Record<string, any>;
  return {
    ...base,
    canvas: { ...base.canvas, background: c.surface1 },
    node: {
      ...base.node,
      // Keep unselected nodes and edges readable when one node is selected.
      inactiveOpacity: 0.7,
      label: { ...base.node.label, color: c.foreground, activeColor: c.foreground, stroke: c.surface1 },
    },
    ring: { fill: c.accent, activeFill: c.accent },
    edge: {
      ...base.edge,
      inactiveOpacity: 0.6,
      fill: c.foregroundMuted,
      activeFill: c.accent,
      label: { ...base.edge.label, color: c.foregroundMuted, activeColor: c.foreground, stroke: c.surface1 },
    },
    arrow: { fill: c.foregroundMuted, activeFill: c.accent },
  };
}

// Fixed kind -> colour and size, from theme colours only, so a kind looks the same in every query.
// Historical, retired or retracted nodes are muted and small so superseded memories read differently
// from current ones. Unknown kinds fall back to a neutral style.
function nodeStyle(theme: PluginTheme, node: GraphCanvasNode) {
  const c = theme.colors;
  if (node.historical || node.status === "retired" || node.status === "retracted") {
    return { fill: c.foregroundMuted, size: 4 };
  }
  switch (node.kind) {
    case "Persona":
      return { fill: c.accent, size: 9 };
    case "Operational":
      return { fill: c.statusSuccess, size: 8 };
    case "CAPA":
      return { fill: c.statusDanger, size: 8 };
    case "Domain":
      return { fill: c.statusWarning, size: 7 };
    case "Area":
      return { fill: c.statusWarning, size: 6 };
    case "Topic":
      return { fill: c.statusWarning, size: 5 };
    case "Operator":
      return { fill: c.foreground, size: 7 };
    case "Memory":
      return { fill: c.foregroundMuted, size: 4 };
    default:
      return { fill: c.foregroundMuted, size: 5 };
  }
}

// Human wording for the node list, matching the rest of the Memory UI.
// Kept local (mirrors labels.ts purposeLabel) so this renderer does not depend on the contracts module.
const PURPOSE_LABELS: Record<string, string> = {
  Persona: "About me",
  Operational: "Project knowledge",
  CAPA: "Correction or prevention",
};
function kindLabel(node: GraphCanvasNode): string {
  if (node.kind === "Memory") return node.historical ? "Historical memory" : "Memory";
  return PURPOSE_LABELS[node.kind] ?? node.kind;
}
function describeNode(node: GraphCanvasNode): string {
  const parts = [kindLabel(node)];
  if (node.required === true) parts.push("Required instruction");
  if (node.status && node.status !== "active") parts.push(node.status);
  if (node.validity) parts.push(node.validity);
  return parts.join(" · ");
}

class CanvasBoundary extends Component<{ onCatch(message: string): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onCatch(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Fault injection target, rendered only when a test harness passes the `fault` prop.
function Thrower(): null {
  throw new Error("injected render failure");
}

function NodeList({ theme, nodes, selected, onSelect, maxHeight }: Pick<GraphCanvasViewProps, "theme" | "nodes" | "selected" | "onSelect"> & { maxHeight: number }) {
  const c = theme.colors;
  return (
    <ScrollView style={{ maxHeight }} accessibilityLabel="Graph nodes">
      {nodes.map((node) => {
        const active = node.id === selected;
        return (
          <Pressable
            key={node.id}
            accessibilityRole="button"
            accessibilityLabel={`${node.label}, ${describeNode(node)}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(active ? null : node.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: active ? c.surface2 : "transparent",
            }}
          >
            <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 13, lineHeight: 18 }}>
              {node.label}
              <Text style={{ color: c.foregroundMuted }}>{`  ${describeNode(node)}`}</Text>
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function GraphCanvasView(props: GraphCanvasViewProps) {
  const { theme, compact } = props;
  const showNodeList = props.showNodeList !== false;
  const c = theme.colors;
  const nodes = useMemo(() => props.nodes.slice(0, GRAPH_CANVAS_NODE_CAP), [props.nodes]);
  const frame = {
    flex: 1,
    minHeight: compact ? 280 : 360,
    backgroundColor: c.surface1,
    borderRadius: 8,
    overflow: "hidden" as const,
  };
  if (!isWeb) {
    return (
      <View style={[frame, { padding: 12, gap: 8 }]}>
        <Text style={{ color: c.foreground, fontSize: 14, lineHeight: 20 }}>
          {showNodeList
            ? "The interactive graph is available in the web and desktop app. Use this list to browse connections."
            : "The interactive graph is available in the web and desktop app."}
        </Text>
        {showNodeList ? (
          <NodeList theme={theme} nodes={nodes} selected={props.selected} onSelect={props.onSelect} maxHeight={240} />
        ) : null}
      </View>
    );
  }
  return <WebGraph {...props} nodes={nodes} frame={frame} total={props.nodes.length} showNodeList={showNodeList} />;
}

type Phase = "loading" | "ready" | "error";

function WebGraph(props: GraphCanvasViewProps & { frame: object; total: number; showNodeList: boolean }) {
  const { theme, edges: allEdges, nodes, selected, onSelect, frame, total, fault, showNodeList } = props;
  const c = theme.colors;
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const [mod, setMod] = useState<ReagraphModule | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const containerRef = useRef<unknown>(null);
  const stopWatchRef = useRef<() => void>(() => {});
  const onErrorRef = useRef(props.onError);
  onErrorRef.current = props.onError;

  const fail = useCallback((text: string) => {
    // One failure per attempt: stop the watch so a later deadline cannot replace this message.
    stopWatchRef.current();
    stopWatchRef.current = () => {};
    setMod(null);
    setMessage(text);
    setPhase("error");
    onErrorRef.current?.(text);
  }, []);

  useEffect(() => {
    setPhase("loading");
    setMod(null);
    const webgl = checkWebGL(fault);
    if (!webgl.ok) {
      fail(webgl.message);
      return;
    }
    const loaded = loadReagraph(fault);
    if (!loaded.ok) {
      fail(loaded.message);
      return;
    }
    // "timeout" fault: never create the canvas, so the start deadline fires.
    if (fault !== "timeout") setMod(loaded.module);
    stopWatchRef.current = watchCanvas(containerRef.current, {
      onReady: () => setPhase((current) => (current === "error" ? current : "ready")),
      onLost: () => fail("The WebGL context was lost."),
      onTimeout: () => fail("The graph canvas did not start within 8 seconds."),
    });
    return () => {
      stopWatchRef.current();
      stopWatchRef.current = () => {};
    };
  }, [attempt, fail, fault]);

  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const graphNodes = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: n.label, data: n, ...nodeStyle(theme, n) })),
    [nodes, theme],
  );
  const graphEdges = useMemo(
    () =>
      allEdges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, data: e })),
    [allEdges, ids],
  );
  const graphTheme = useMemo(() => (mod ? reagraphTheme(mod, theme) : null), [mod, theme]);

  const summary = `Memory graph: ${nodes.length} nodes, ${graphEdges.length} connections. The canvas is visual only; use the node list to select.`;
  return (
    <View style={[frame, { gap: 0 }]}>
      <View style={{ flex: 1, minHeight: 0 }} accessibilityRole="image" accessibilityLabel={summary}>
        <View ref={containerRef as never} style={{ flex: 1 }}>
          {mod && graphTheme && phase !== "error" ? (
            <CanvasBoundary key={attempt} onCatch={(text) => fail(`The graph failed while drawing: ${text}`)}>
              {fault === "render-react" ? <Thrower /> : null}
              {createElement(
                mod.GraphCanvas,
                {
                  nodes: graphNodes,
                  edges: graphEdges,
                  layoutType: "forceDirected2d",
                  cameraMode: "pan",
                  draggable: true,
                  labelType: "all",
                  edgeArrowPosition: "end",
                  theme: graphTheme,
                  selections: selected && ids.has(selected) ? [selected] : [],
                  onNodeClick: (node: { id: string }) => onSelect(node.id),
                  onCanvasClick: () => onSelect(null),
                },
                fault === "render-canvas" ? createElement(Thrower) : undefined,
              )}
            </CanvasBoundary>
          ) : null}
        </View>
        {phase === "loading" ? (
          <View
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <ActivityIndicator color={c.foregroundMuted} />
            <Text style={{ color: c.foregroundMuted, fontSize: 13 }}>Loading graph…</Text>
          </View>
        ) : null}
        {phase === "error" ? (
          <View
            accessibilityRole="alert"
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, padding: 16, gap: 10, justifyContent: "center", backgroundColor: c.surface1 }}
          >
            <Text style={{ color: c.foreground, fontSize: 15, fontWeight: "600" }}>Graph view unavailable</Text>
            <Text style={{ color: c.foreground, fontSize: 14, lineHeight: 20 }}>Try again or continue in List.</Text>
            <Text style={{ color: c.foregroundMuted, fontSize: 12, lineHeight: 17 }}>{`Detail: ${message}`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading the graph"
              onPress={() => setAttempt((n) => n + 1)}
              style={{ alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.accent }}
            >
              <Text style={{ color: c.accentForeground, fontSize: 14, fontWeight: "600" }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {total > nodes.length ? (
          <Text pointerEvents="none" style={{ position: "absolute", left: 8, bottom: 6, color: c.foregroundMuted, fontSize: 12 }}>
            {phase === "error" ? `${nodes.length} of ${total} nodes loaded` : `Showing ${nodes.length} of ${total} nodes`}
          </Text>
        ) : null}
      </View>
      {showNodeList ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
          {phase === "error" ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: listOpen }}
              accessibilityLabel={listOpen ? "Hide node list" : "Show node list"}
              onPress={() => setListOpen((open) => !open)}
              style={{ paddingVertical: 8, paddingHorizontal: 10 }}
            >
              <Text style={{ color: c.foregroundMuted, fontSize: 13 }}>{`${listOpen ? "Hide" : "Show"} node list (${nodes.length})`}</Text>
            </Pressable>
          )}
          {phase === "error" || listOpen ? (
            <NodeList theme={theme} nodes={nodes} selected={selected} onSelect={onSelect} maxHeight={160} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
