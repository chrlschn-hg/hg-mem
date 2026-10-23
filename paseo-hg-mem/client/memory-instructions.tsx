import type { UseQueryResult } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import type { MemoryPage } from "../shared/contracts";
import { errorMessage, plural } from "./labels";
import { MemoryRow, Pager } from "./memory-rows";
import { Action, StateBlock } from "./parts";
import { useRestoredScroll } from "./scroll-memory";
import { PAGE_SIZE, type PanelUi } from "./types";

type MemoryInstructionsProps = {
  ui: PanelUi;
  page: UseQueryResult<MemoryPage>;
  offset: number;
  selectedId: string | null;
  onOffset(offset: number): void;
  onOpen(id: string): void;
  onNew(): void;
};

export function MemoryInstructions({ ui, page, offset, selectedId, onOffset, onOpen, onNew }: MemoryInstructionsProps) {
  const { styles } = ui;
  const scroll = useRestoredScroll(ui.scroll, "instructions");
  const data = page.data;
  const settled = data !== undefined && !page.isPlaceholderData;
  const heading = data
    ? `${data.total} required ${plural(data.total, "instruction", "instructions")} for this directory`
    : "Required instructions";

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
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.muted}>
        Listed whatever you search for. Being listed does not show that an agent has read the full text.
      </Text>

      {settled && data.total > PAGE_SIZE ? (
        <Pager
          styles={styles}
          offset={offset}
          count={data.items.length}
          total={data.total}
          pageSize={PAGE_SIZE}
          onOffset={onOffset}
        />
      ) : null}

      {page.isPending ? <Text style={styles.muted}>Loading instructions…</Text> : null}

      {page.isError ? (
        <StateBlock styles={styles} title="Could not load instructions" body={errorMessage(page.error)}>
          <Action styles={styles} label="Try again" onPress={() => void page.refetch()} />
        </StateBlock>
      ) : null}

      {settled && data.total === 0 ? (
        <StateBlock
          styles={styles}
          title="No required instructions for this directory"
          body="A memory becomes a required instruction when you turn on Treat as an instruction while creating it."
        >
          <Action styles={styles} tone="primary" label="New memory" onPress={onNew} />
        </StateBlock>
      ) : null}

      {data && data.items.length > 0 ? (
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
      ) : null}

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
