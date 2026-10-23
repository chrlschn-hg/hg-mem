import type { RefObject } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { MemoryGraphNode } from "./graph-model";
import { isMemoryNode, typeLabel } from "./graph-helpers";
import { plural } from "./labels";
import { Badge } from "./parts";
import type { PanelUi, ResultView } from "./types";

// The one shared toolbar for Memories: search, List | Graph, and in graph view the Nodes and Layout disclosures.
// Disclosures are honest in-flow regions: expanded state, normal focus order, and one bounded region open at a time.
export type OpenMenu = "nodes" | "layout" | null;

type MemoryToolbarProps = {
  ui: PanelUi;
  searchText: string;
  onSearchText(text: string): void;
  onSubmitSearch(): void;
  view: ResultView;
  onView(view: ResultView): void;
  graphActive: boolean;
  nodeCount: number;
  openMenu: OpenMenu;
  onToggleMenu(menu: Exclude<OpenMenu, null>): void;
  splitGraph: boolean;
  // False while a single-pane inspector covers the graph. Its top row carries Layout then.
  showLayout: boolean;
  // Where focus returns after a choice: the Nodes trigger when no inspector can take focus, and the Layout trigger.
  nodesFocusRef: RefObject<View | null>;
  layoutFocusRef: RefObject<View | null>;
};

export function MemoryToolbar({
  ui,
  searchText,
  onSearchText,
  onSubmitSearch,
  view,
  onView,
  graphActive,
  nodeCount,
  openMenu,
  onToggleMenu,
  splitGraph,
  showLayout,
  nodesFocusRef,
  layoutFocusRef,
}: MemoryToolbarProps) {
  const { styles, theme, compact } = ui;
  const controlHeight = compact ? 44 : 36;

  return (
    <View style={styles.commandRow}>
      <TextInput
        value={searchText}
        onChangeText={onSearchText}
        onSubmitEditing={onSubmitSearch}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Search memories"
        placeholderTextColor={theme.colors.foregroundMuted}
        accessibilityLabel="Search memories"
        style={[styles.input, styles.searchField, { minHeight: controlHeight }]}
      />
      <ViewSwitch ui={ui} view={view} onView={onView} controlHeight={controlHeight} />
      {graphActive ? (
        <View style={styles.row}>
          <DisclosureTrigger
            ui={ui}
            label={`Nodes (${nodeCount})`}
            expanded={openMenu === "nodes"}
            controlHeight={controlHeight}
            focusRef={nodesFocusRef}
            onPress={() => onToggleMenu("nodes")}
          />
          {showLayout ? (
            <LayoutTrigger
              ui={ui}
              splitGraph={splitGraph}
              expanded={openMenu === "layout"}
              focusRef={layoutFocusRef}
              onPress={() => onToggleMenu("layout")}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// The Layout disclosure. The toolbar and a single-pane inspector show the same state and open the same choices.
export function LayoutTrigger({
  ui,
  splitGraph,
  expanded,
  focusRef,
  onPress,
}: {
  ui: PanelUi;
  splitGraph: boolean;
  expanded: boolean;
  focusRef: RefObject<View | null>;
  onPress(): void;
}) {
  return (
    <DisclosureTrigger
      ui={ui}
      label={`Layout: ${splitGraph ? "Split" : "Auto"}`}
      expanded={expanded}
      controlHeight={ui.compact ? 44 : 36}
      focusRef={focusRef}
      onPress={onPress}
    />
  );
}

// List | Graph is one grouped track. Its segments fill the track, so the track is exactly the control height.
function ViewSwitch({
  ui,
  view,
  onView,
  controlHeight,
}: {
  ui: PanelUi;
  view: ResultView;
  onView(view: ResultView): void;
  controlHeight: number;
}) {
  const { styles } = ui;
  const options: { view: ResultView; label: string }[] = [
    { view: "list", label: "List" },
    { view: "graph", label: "Graph" },
  ];
  return (
    <View accessibilityRole="tablist" style={[styles.viewTrack, { height: controlHeight }]}>
      {options.map((option) => {
        const selected = option.view === view;
        return (
          <Pressable
            key={option.view}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => onView(option.view)}
            style={[styles.viewSegment, selected && styles.viewSegmentActive]}
          >
            <Text style={styles.segmentText}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DisclosureTrigger({
  ui,
  label,
  expanded,
  controlHeight,
  focusRef,
  onPress,
}: {
  ui: PanelUi;
  label: string;
  expanded: boolean;
  controlHeight: number;
  focusRef: RefObject<View | null>;
  onPress(): void;
}) {
  const { styles } = ui;
  return (
    <Pressable
      ref={focusRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      style={[styles.chip, expanded && styles.chipActive, { minHeight: controlHeight }]}
    >
      <Text style={styles.chipText}>{expanded ? `${label} ▴` : `${label} ▾`}</Text>
    </Pressable>
  );
}

// The Nodes picker. One line of counts, then a list that alone scrolls within listHeight. Choosing a node closes the
// picker and selects it, so the shared inspector shows that node. Required memories carry the list's badge.
export function NodePicker({
  ui,
  nodes,
  selectedId,
  requiredIds,
  listHeight,
  onPick,
}: {
  ui: PanelUi;
  nodes: readonly MemoryGraphNode[];
  selectedId: string | null;
  requiredIds: ReadonlySet<string>;
  listHeight: number;
  onPick(id: string): void;
}) {
  const { styles } = ui;
  const memories = nodes.filter(isMemoryNode).length;
  const context = nodes.length - memories;
  const memoryText = `${memories} ${plural(memories, "memory", "memories")}`;
  const contextText = `${context} ${plural(context, "context node", "context nodes")}`;
  return (
    <View style={styles.disclosure}>
      <Text style={styles.muted}>{`${memoryText} · ${contextText}`}</Text>
      <ScrollView style={{ maxHeight: listHeight }} accessibilityLabel="Graph nodes">
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          const required = requiredIds.has(node.id);
          return (
            <Pressable
              key={node.id}
              accessibilityRole="button"
              accessibilityLabel={`${node.label}, ${typeLabel(node)}${required ? ", required instruction" : ""}`}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => onPick(node.id)}
              style={[styles.rowItem, selected && styles.rowItemSelected]}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {node.label}
              </Text>
              <View style={styles.row}>
                <Text style={styles.muted}>{typeLabel(node)}</Text>
                {required ? <Badge styles={styles} text="Required instruction" /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// The Layout choices. The current choice is marked in visible text, and the panel announces each change.
export function LayoutChoices({
  ui,
  splitGraph,
  onChoose,
}: {
  ui: PanelUi;
  splitGraph: boolean;
  onChoose(split: boolean): void;
}) {
  const { styles } = ui;
  const options = [
    { split: false, label: "Auto (by width)" },
    { split: true, label: "Split beside the inspector" },
  ];
  return (
    <View style={styles.disclosure}>
      {options.map((option) => {
        const selected = option.split === splitGraph;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChoose(option.split)}
            style={[styles.rowItem, selected && styles.rowItemSelected]}
          >
            <Text style={styles.rowTitle}>
              {selected ? "✓ " : ""}
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
