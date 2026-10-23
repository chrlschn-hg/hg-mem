import type { UseQueryResult } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import type { MemoryPage } from "../shared/contracts";
import { errorMessage, plural } from "./labels";
import { MemoryRow, Pager } from "./memory-rows";
import { Action, StateBlock } from "./parts";
import { useRestoredScroll } from "./scroll-memory";
import { PAGE_SIZE, type PanelUi } from "./types";
import type { MemoryStyles } from "./styles";

// The search field lives in the shared toolbar. This list shows the required-instruction summary and the results.
type MemoryBrowseProps = {
  ui: PanelUi;
  query: string;
  offset: number;
  selectedId: string | null;
  page: UseQueryResult<MemoryPage>;
  required: UseQueryResult<MemoryPage>;
  onOffset(offset: number): void;
  onOpen(id: string): void;
  onNew(): void;
  onShowInstructions(): void;
  onClearSearch(): void;
};

export function MemoryBrowse({
  ui,
  query,
  offset,
  selectedId,
  page,
  required,
  onOffset,
  onOpen,
  onNew,
  onShowInstructions,
  onClearSearch,
}: MemoryBrowseProps) {
  const { styles } = ui;
  const scroll = useRestoredScroll(ui.scroll, "results");
  const data = page.data;
  const settled = data !== undefined && !page.isPlaceholderData;

  let results = null;
  if (page.isError) {
    results = (
      <StateBlock styles={styles} title="Could not load memories" body={errorMessage(page.error)}>
        <Action styles={styles} label="Try again" onPress={() => void page.refetch()} />
      </StateBlock>
    );
  } else if (settled && data.total === 0) {
    results = query ? (
      <StateBlock
        styles={styles}
        title={`No matches for “${query}”`}
        body="Required instructions above are not affected by the search."
      >
        <Action styles={styles} label="Clear search" onPress={onClearSearch} />
      </StateBlock>
    ) : (
      <StateBlock
        styles={styles}
        title="No memories for this directory yet"
        body="Nothing is saved until you press Save in New memory."
      >
        <Action styles={styles} tone="primary" label="New memory" onPress={onNew} />
      </StateBlock>
    );
  } else if (data) {
    results = (
      <View>
        {page.isPlaceholderData ? <Text style={styles.muted}>Updating…</Text> : null}
        {data.items.map((record) => (
          <MemoryRow
            key={record.id}
            styles={styles}
            record={record}
            selected={record.id === selectedId}
            onPress={() => onOpen(record.id)}
          />
        ))}
      </View>
    );
  } else {
    results = <Text style={styles.muted}>Loading memories…</Text>;
  }

  return (
    <ScrollView
      ref={scroll.ref}
      onScroll={scroll.onScroll}
      onContentSizeChange={scroll.onContentSizeChange}
      scrollEventThrottle={100}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <RequiredSummary styles={styles} required={required} onShow={onShowInstructions} />

      {results}

      {settled && data.total > 0 ? (
        <Pager
          styles={styles}
          offset={offset}
          count={data.items.length}
          total={data.total}
          pageSize={PAGE_SIZE}
          onOffset={onOffset}
        />
      ) : null}
    </ScrollView>
  );
}

// One slim, divided row: the count on the left, the explicit action on the right.
function RequiredSummary({
  styles,
  required,
  onShow,
}: {
  styles: MemoryStyles;
  required: UseQueryResult<MemoryPage>;
  onShow(): void;
}) {
  if (required.isError) {
    return (
      <View style={styles.summaryRow}>
        <Text style={styles.danger}>Instructions unavailable. {errorMessage(required.error)}</Text>
        <Action styles={styles} tone="link" label="Try again" onPress={() => void required.refetch()} />
      </View>
    );
  }
  const total = required.data?.total;
  if (total === undefined) {
    return (
      <View style={styles.summaryRow}>
        <Text style={styles.muted}>Checking required instructions…</Text>
      </View>
    );
  }
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.text}>
        {total} required {plural(total, "instruction", "instructions")}
      </Text>
      <Action styles={styles} tone="link" label="View instructions ›" onPress={onShow} />
    </View>
  );
}
