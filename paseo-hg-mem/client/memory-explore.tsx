import type { ReactNode, RefObject } from "react";
import { ScrollView, Text, View } from "react-native";
import { channelLabel, switchChannel } from "./explore";
import { useMemoryExplore } from "./hooks";
import { errorMessage } from "./labels";
import { MemoryRow, Pager, RevisionRow } from "./memory-rows";
import { Action, Chip, Section, StateBlock } from "./parts";
import { useRestoredScroll } from "./scroll-memory";
import type { MemoryStyles } from "./styles";
import { PAGE_SIZE, PREVIEW_SIZE, type ExplorePane, type Pane, type PanelUi } from "./types";

type MemoryExploreProps = {
  ui: PanelUi;
  pane: ExplorePane;
  // The pane below this one. Results is always one control away.
  backLabel: string | null;
  onBack(): void;
  onResults(): void;
  onChange(pane: ExplorePane): void;
  // "Back to graph" when the graph is where the reader came from; otherwise "Back to results".
  resultsLabel: string;
  onOpen(pane: Pane): void;
  // The control focus moves to after a choice from the graph.
  focusRef: RefObject<View | null>;
  // Layout beside the Back controls in a single-pane inspector, and its choices directly under the top row when open.
  layoutTrigger?: ReactNode;
  layoutChoices?: ReactNode;
};

// One channel at a time. Current memories and replacement history are separate lists and never mixed.
export function MemoryExplore({
  ui,
  pane,
  backLabel,
  onBack,
  onResults,
  onChange,
  resultsLabel,
  onOpen,
  focusRef,
  layoutTrigger,
  layoutChoices,
}: MemoryExploreProps) {
  const { styles } = ui;
  const { active } = pane;
  const revisions = active.relation === "revisions";
  const limit = pane.expanded ? PAGE_SIZE : PREVIEW_SIZE;
  const scroll = useRestoredScroll(ui.scroll, `explore:${active.id}:${active.relation}`);
  const page = useMemoryExplore(ui.hostId, active.id, active.relation, ui.context, pane.offset, limit);
  const data = page.data;

  return (
    <ScrollView
      ref={scroll.ref}
      onScroll={scroll.onScroll}
      onContentSizeChange={scroll.onContentSizeChange}
      scrollEventThrottle={100}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.actions}>
        {backLabel ? <Action styles={styles} label={backLabel} onPress={onBack} /> : null}
        <Action styles={styles} label={resultsLabel} onPress={onResults} focusRef={focusRef} />
        {layoutTrigger}
      </View>
      {layoutChoices}

      <View style={styles.stack}>
        <Text selectable style={styles.title}>
          {pane.title}
        </Text>
        <Text style={styles.muted}>{pane.subtitle}</Text>
      </View>

      {pane.connections.length > 1 ? (
        <View style={styles.row}>
          {pane.connections.map((connection) => (
            <Chip
              key={`${connection.relation}:${connection.id}`}
              styles={styles}
              label={channelLabel(connection)}
              selected={connection.relation === active.relation && connection.id === active.id}
              onPress={() => onChange(switchChannel(pane, connection))}
            />
          ))}
        </View>
      ) : null}

      {page.isError ? (
        <StateBlock styles={styles} title="Could not load these connections" body={errorMessage(page.error)}>
          <Action styles={styles} label="Try again" onPress={() => void page.refetch()} />
        </StateBlock>
      ) : null}

      {revisions ? (
        <Section styles={styles} title="Replacement history">
          {data === undefined && !page.isError ? <Text style={styles.muted}>Loading replacement history…</Text> : null}
          {data && data.history.length === 0 ? (
            <Text style={styles.muted}>
              {data.total === 0 ? "No replacement links recorded." : "No replacement links listed here."}
            </Text>
          ) : null}
          {data?.history.map((revision) => (
            <RevisionRow
              key={revision.id}
              styles={styles}
              revision={revision}
              onPress={() => onOpen({ kind: "memory", id: revision.id })}
            />
          ))}
          {data ? (
            <ChannelPager styles={styles} pane={pane} shown={data.history.length} total={data.total} onChange={onChange} />
          ) : null}
          {data && data.history.length > 0 ? (
            <Text style={styles.muted}>
              Older and newer versions are history. A newer version does not by itself show what applies now.
            </Text>
          ) : null}
        </Section>
      ) : null}

      {!revisions || (data !== undefined && data.items.length > 0) ? (
        <Section styles={styles} title={revisions ? "Related memories in this workspace" : channelLabel(active)}>
          {data === undefined && !page.isError ? <Text style={styles.muted}>Loading…</Text> : null}
          {data && !revisions ? <Text style={styles.muted}>Eligible in this workspace.</Text> : null}
          {data && data.items.length === 0 && data.total === 0 ? (
            <Text style={styles.muted}>No related memories available here.</Text>
          ) : null}
          {data && data.items.length === 0 && data.total > 0 && !pane.expanded ? (
            <Text style={styles.muted}>No rows on this page.</Text>
          ) : null}
          {data?.items.map(({ memory }) => (
            <MemoryRow
              key={memory.id}
              styles={styles}
              record={memory}
              selected={false}
              onPress={() => onOpen({ kind: "memory", id: memory.id })}
            />
          ))}
          {data && !revisions ? (
            <ChannelPager styles={styles} pane={pane} shown={data.items.length} total={data.total} onChange={onChange} />
          ) : null}
        </Section>
      ) : null}
    </ScrollView>
  );
}

// Paging for whichever list the channel shows. The range is always stated when rows exist; View all appears only when rows are clipped.
function ChannelPager({
  styles,
  pane,
  shown,
  total,
  onChange,
}: {
  styles: MemoryStyles;
  pane: ExplorePane;
  shown: number;
  total: number;
  onChange(pane: ExplorePane): void;
}) {
  if (pane.expanded) {
    return (
      <>
        <Pager
          styles={styles}
          offset={pane.offset}
          count={shown}
          total={total}
          pageSize={PAGE_SIZE}
          onOffset={(offset) => onChange({ ...pane, offset })}
        />
        <Action
          styles={styles}
          tone="link"
          label="Show fewer"
          onPress={() => onChange({ ...pane, expanded: false, offset: 0 })}
        />
      </>
    );
  }
  if (shown === 0) return null;
  return (
    <View style={styles.pager}>
      <Text style={styles.muted}>
        Showing 1–{shown} of {total}
      </Text>
      {total > shown ? (
        <Action
          styles={styles}
          tone="link"
          label={`View all (${total})`}
          onPress={() => onChange({ ...pane, expanded: true, offset: 0 })}
        />
      ) : null}
    </View>
  );
}
