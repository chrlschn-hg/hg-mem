import { useState } from "react";
import { Text, View } from "react-native";
import { GraphCanvasView } from "./graph-canvas";
import { GRAPH_NODE_LIMIT, type MemoryGraphData } from "./graph-model";
import { Action, StateBlock } from "./parts";
import type { PanelUi } from "./types";

// The pinned canvas for the Memories region. It sits outside any body scroll, so it stays on screen while the inspector
// and the Nodes picker open. The canvas owns its loading and retry UI; "Use list" appears only in real error states.
type MemoryGraphProps = {
  ui: PanelUi;
  model: MemoryGraphData | null;
  modelError: string | null;
  selectedId: string | null;
  onSelect(id: string | null): void;
  pageStatus: "loading" | "ready" | "error";
  pageError: string | null;
  onRetryPage(): void;
  onUseList(): void;
};

export function MemoryGraph({
  ui,
  model,
  modelError,
  selectedId,
  onSelect,
  pageStatus,
  pageError,
  onRetryPage,
  onUseList,
}: MemoryGraphProps) {
  const { styles, theme, compact } = ui;
  const [rendererError, setRendererError] = useState<string | null>(null);

  if (pageStatus === "error") {
    return (
      <View style={styles.fill}>
        <StateBlock styles={styles} title="Could not load results for the graph" body={pageError}>
          <Action styles={styles} label="Try again" onPress={onRetryPage} />
          <Action styles={styles} label="Use list" onPress={onUseList} />
        </StateBlock>
      </View>
    );
  }

  if (modelError) {
    return (
      <View style={styles.fill}>
        <StateBlock styles={styles} title="The graph could not be built from these results" body={modelError}>
          <Action styles={styles} label="Use list" onPress={onUseList} />
        </StateBlock>
      </View>
    );
  }

  if (!model) {
    return (
      <View style={styles.fill}>
        <Text style={styles.muted}>Loading results…</Text>
      </View>
    );
  }

  if (model.nodes.length === 0) {
    return (
      <View style={styles.fill}>
        <StateBlock styles={styles} title="No matching memories to draw" body="Change the search above." />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {rendererError ? (
        <View style={styles.row}>
          <Text style={styles.muted}>Graph view unavailable. Try again or continue in List.</Text>
          <Action styles={styles} tone="link" label="Use list" onPress={onUseList} />
        </View>
      ) : null}
      <View style={[styles.graphCanvas, compact && styles.graphCanvasCompactFill]}>
        <GraphCanvasView
          theme={theme}
          compact={compact}
          nodes={model.nodes}
          edges={model.edges}
          selected={selectedId}
          onSelect={onSelect}
          onError={setRendererError}
          showNodeList={false}
        />
      </View>
      {model.omitted > 0 ? (
        <Text style={styles.muted}>
          {model.omitted} more not loaded at the {GRAPH_NODE_LIMIT}-node limit.
        </Text>
      ) : null}
    </View>
  );
}
