import type { ReactNode, RefObject } from "react";
import { Text, View } from "react-native";
import type { MemoryGraphNode } from "./graph-model";
import { relationFor, typeLabel } from "./graph-helpers";
import { Action, Section } from "./parts";
import type { GraphExpansion, PanelUi } from "./types";

// The shared inspector for a context node. It sits in the same destination as the memory detail: the right column when
// the graph is split, or the single pane under Auto narrow, with the same Back control. Selection never expands.
type ContextInspectorProps = {
  ui: PanelUi;
  node: MemoryGraphNode;
  ancestry: string | null;
  expansion: GraphExpansion | undefined;
  onExpand(): void;
  backLabel: string;
  onBack(): void;
  // Where focus lands after a choice from the graph: the Back control, the first thing in the inspector.
  focusRef: RefObject<View | null>;
  // Layout beside Back in a single-pane inspector, and its choices directly under the top row when open.
  layoutTrigger?: ReactNode;
  layoutChoices?: ReactNode;
};

export function ContextInspector({
  ui,
  node,
  ancestry,
  expansion,
  onExpand,
  backLabel,
  onBack,
  focusRef,
  layoutTrigger,
  layoutChoices,
}: ContextInspectorProps) {
  const { styles } = ui;
  const subject = relationFor(node) === "subject";
  const shown = expansion?.items.length ?? 0;
  const remaining = expansion ? Math.max(0, expansion.total - shown) : 0;

  return (
    <View style={styles.stack}>
      <View style={styles.actions}>
        <Action styles={styles} label={backLabel} onPress={onBack} focusRef={focusRef} />
        {layoutTrigger}
      </View>
      {layoutChoices}
      <View style={styles.stack}>
        <Text selectable style={styles.title}>
          {node.label}
        </Text>
        <Text style={styles.muted}>
          {typeLabel(node)}
          {ancestry ? ` · ${ancestry}` : ""}
        </Text>
        <Text style={styles.muted}>
          {subject
            ? "Memories about this person. This is not who wrote them."
            : "Memories filed under this node. Filing does not decide what applies."}
        </Text>
      </View>

      <Section styles={styles} title="Linked memories">
        {expansion && expansion.status !== "loading" && shown > 0 ? (
          <Text style={styles.text}>
            {shown} of {expansion.total} linked memories loaded{remaining > 0 ? "" : ". All loaded"}
          </Text>
        ) : null}
        {expansion?.status === "loading" ? (
          <Text style={styles.muted}>Loading connections{shown > 0 ? ` · ${shown} shown so far` : ""}…</Text>
        ) : null}
        {expansion?.status === "error" ? (
          <Text style={styles.danger}>
            {shown > 0 ? "Could not load more. Loaded memories are still shown." : "Could not load connections."}{" "}
            {expansion.error}
          </Text>
        ) : null}
        {expansion?.status === "ready" && shown === 0 ? (
          <Text style={styles.muted}>
            No linked memories returned in this workspace. This does not show that none exist elsewhere.
          </Text>
        ) : null}
        {expansion === undefined ? (
          <Text style={styles.muted}>
            {subject
              ? "Expand to check for more memories about this person."
              : "Expand this topic to check for more linked memories."}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {expansion === undefined || (expansion.status === "error" && shown === 0) ? (
            <Action
              styles={styles}
              label={expansion ? "Try again" : "Expand connections"}
              onPress={onExpand}
            />
          ) : null}
          {expansion?.status === "ready" && remaining > 0 ? (
            <Action styles={styles} label={`Load more (${remaining} left)`} onPress={onExpand} />
          ) : null}
          {expansion?.status === "error" && shown > 0 ? (
            <Action styles={styles} label="Try again" onPress={onExpand} />
          ) : null}
        </View>
      </Section>
    </View>
  );
}
