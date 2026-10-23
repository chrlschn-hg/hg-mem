import { Pressable, Text, View } from "react-native";
import type { MemoryRecord, RevisionRef } from "../shared/contracts";
import {
  appliesLabel,
  excerpt,
  historicalTag,
  purposeLabel,
  revisionDirectionLabel,
  revisionStateLabel,
  rowLinkLine,
} from "./labels";
import { Action, Badge } from "./parts";
import type { MemoryStyles } from "./styles";

export function MemoryRow({
  styles,
  record,
  selected,
  onPress,
}: {
  styles: MemoryStyles;
  record: MemoryRecord;
  selected: boolean;
  onPress(): void;
}) {
  const historical = historicalTag(record);
  const link = rowLinkLine(record);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={record.title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.rowItem, selected && styles.rowItemSelected]}
    >
      <Text style={styles.rowTitle} numberOfLines={2}>
        {record.title}
      </Text>
      <Text style={styles.muted} numberOfLines={2}>
        {excerpt(record.content)}
      </Text>
      <View style={styles.row}>
        {record.required ? <Badge styles={styles} text="Required instruction" /> : null}
        {historical ? <Badge styles={styles} text={historical} /> : null}
        {record.revisions.length > 0 ? <Badge styles={styles} text="Revised" /> : null}
        {record.validity === "POSSIBLE" ? <Badge styles={styles} text="May apply" /> : null}
        {record.assertionKind === "inferred" ? <Badge styles={styles} text="Inferred" /> : null}
      </View>
      {link ? (
        <Text style={styles.muted} numberOfLines={1}>
          {link}
        </Text>
      ) : null}
      <Text style={styles.muted} numberOfLines={1}>
        {purposeLabel(record.purpose)} · {appliesLabel(record)}
      </Text>
    </Pressable>
  );
}

// A related version. Direction and state come first, then the title, so history never reads as current.
export function RevisionRow({
  styles,
  revision,
  onPress,
}: {
  styles: MemoryStyles;
  revision: RevisionRef;
  onPress(): void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={revision.title} onPress={onPress} style={styles.rowItem}>
      <Text style={styles.muted}>
        {revisionDirectionLabel(revision.direction)} · {revisionStateLabel(revision)}
      </Text>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {revision.title}
      </Text>
    </Pressable>
  );
}

export function Pager({
  styles,
  offset,
  count,
  total,
  pageSize,
  onOffset,
}: {
  styles: MemoryStyles;
  offset: number;
  count: number;
  total: number;
  pageSize: number;
  onOffset(offset: number): void;
}) {
  if (total === 0) return null;
  if (count === 0) {
    return (
      <View style={styles.pager}>
        <Text style={styles.muted}>No rows on this page.</Text>
        <Action styles={styles} tone="link" label="First page" onPress={() => onOffset(0)} />
      </View>
    );
  }
  const first = offset + 1;
  const last = offset + count;
  return (
    <View style={styles.pager}>
      <Text style={styles.muted}>
        Showing {first}–{last} of {total}
      </Text>
      <View style={styles.row}>
        {offset > 0 ? (
          <Action
            styles={styles}
            tone="link"
            label="Previous"
            onPress={() => onOffset(Math.max(0, offset - pageSize))}
          />
        ) : null}
        {last < total ? (
          <Action styles={styles} tone="link" label="Next" onPress={() => onOffset(offset + pageSize)} />
        ) : null}
      </View>
    </View>
  );
}
