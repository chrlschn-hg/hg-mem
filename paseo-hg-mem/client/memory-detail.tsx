import { Fragment, useState, type ReactNode, type RefObject } from "react";
import { ScrollView, Text, View } from "react-native";
import { attachmentText } from "../shared/snapshot";
import { connectionsFor, filingCrumb, memoryExplorer, nodeExplorer, subjectNode } from "./explore";
import { useMemoryRecord } from "./hooks";
import {
  assertionLabel,
  errorMessage,
  formatDate,
  historicalTag,
  historyBanner,
  matchLabel,
  purposeLabel,
  scopeText,
  statusLabel,
  timeLabel,
} from "./labels";
import { RevisionRow } from "./memory-rows";
import { Action, Badge, Banner, Crumb, Section, StateBlock } from "./parts";
import { useRestoredScroll } from "./scroll-memory";
import type { MemoryStyles } from "./styles";
import type { Pane, PanelUi } from "./types";

type MemoryDetailProps = {
  ui: PanelUi;
  id: string;
  narrow: boolean;
  // The pane below this one, if there is one. Results is always one control away.
  backLabel: string | null;
  onBack(): void;
  onResults(): void;
  // "Back to graph" when the graph is where the reader came from; otherwise "Back to results".
  resultsLabel: string;
  onOpen(pane: Pane): void;
  // The control focus moves to after a choice from the graph.
  focusRef: RefObject<View | null>;
  // Layout beside the Back controls in a single-pane inspector, and its choices directly under the top row when open.
  layoutTrigger?: ReactNode;
  layoutChoices?: ReactNode;
};

export function MemoryDetail({
  ui,
  id,
  narrow,
  backLabel,
  onBack,
  onResults,
  resultsLabel,
  onOpen,
  focusRef,
  layoutTrigger,
  layoutChoices,
}: MemoryDetailProps) {
  const { styles } = ui;
  const record = useMemoryRecord(ui.hostId, id);
  const scroll = useRestoredScroll(ui.scroll, `detail:${id}`);
  const [showDetails, setShowDetails] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const memory = record.data;
  // A single wide pane says Close. Anywhere with a pane below, the control names Results.
  const backToResults = backLabel === null && !narrow ? "Close" : resultsLabel;
  const back = (
    <View style={styles.actions}>
      {backLabel ? <Action styles={styles} label={backLabel} onPress={onBack} /> : null}
      <Action styles={styles} label={backToResults} onPress={onResults} focusRef={focusRef} />
      {layoutTrigger}
    </View>
  );

  if (record.isError) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailTop}>{back}</View>
        {layoutChoices}
        <StateBlock styles={styles} title="Could not open this memory" body={errorMessage(record.error)}>
          <Action styles={styles} label="Try again" onPress={() => void record.refetch()} />
        </StateBlock>
      </ScrollView>
    );
  }

  if (!memory) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailTop}>{back}</View>
        {layoutChoices}
        <Text style={styles.muted}>Loading memory…</Text>
      </ScrollView>
    );
  }

  const historical = historicalTag(memory);
  const banner = historyBanner(memory);
  const subject = memory.subject;
  const assertedBy = memory.assertedBy === ui.operatorId ? ui.operatorName : memory.assertedBy;
  // Explore connections opens on the filed-under node when there is one, else the operator (the Persona fallback).
  // A record that is no longer current has only its own history to open on (see connectionsFor).
  const defaultChannel = connectionsFor(memory)[0];
  const badges = (
    <View style={styles.row}>
      {memory.required ? <Badge styles={styles} text="Required instruction" /> : null}
      <Badge styles={styles} text={purposeLabel(memory.purpose)} />
      {historical ? <Badge styles={styles} text={historical} /> : null}
    </View>
  );

  return (
    <ScrollView
      ref={scroll.ref}
      onScroll={scroll.onScroll}
      onContentSizeChange={scroll.onContentSizeChange}
      scrollEventThrottle={100}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {narrow ? (
        <>
          <View style={styles.detailTop}>{back}</View>
          {badges}
        </>
      ) : (
        <View style={styles.detailTop}>
          {badges}
          {back}
        </View>
      )}

      {layoutChoices}
      {banner ? <Banner styles={styles} title={banner.title} body={banner.body} /> : null}

      <View style={styles.stack}>
        <Text selectable style={styles.title}>
          {memory.title}
        </Text>
        <Text selectable style={styles.paragraph}>
          {memory.content}
        </Text>
      </View>

      <View style={styles.actions}>
        <Action styles={styles} label="Explore connections" onPress={() => onOpen(memoryExplorer(memory, defaultChannel))} />
        <Action
          styles={styles}
          label={showAttachment ? "Hide attachment text" : "Preview attachment text"}
          onPress={() => setShowAttachment((open) => !open)}
        />
      </View>

      {showAttachment ? (
        <Section styles={styles} title="Attachment text">
          <Text selectable style={styles.text}>
            {attachmentText(memory)}
          </Text>
          <Text style={styles.muted}>
            Review attachment text here; Paseo 0.12 attachment chips do not reopen local memories.
          </Text>
        </Section>
      ) : null}

      <Section styles={styles} title="Filed under">
        {memory.filingPath.length > 0 ? (
          <View style={styles.crumbRow}>
            {memory.filingPath.map((node, index) => (
              <Fragment key={node.id}>
                {index > 0 ? <Text style={styles.muted}>›</Text> : null}
                <Crumb
                  styles={styles}
                  label={node.name}
                  onPress={() => onOpen(nodeExplorer(filingCrumb(memory.filingPath, index)))}
                />
              </Fragment>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>Not filed under a topic.</Text>
        )}
      </Section>

      {subject ? (
        <Section styles={styles} title="About">
          <Crumb styles={styles} label={subject.name} onPress={() => onOpen(nodeExplorer(subjectNode(subject)))} />
          <Text style={styles.muted}>The operator this memory is about. Who recorded it is under Asserted by.</Text>
        </Section>
      ) : null}

      <Section styles={styles} title="Applies to">
        {memory.scopes.map((scope) => {
          const match = matchLabel(scope.matched);
          return (
            <View key={scope.id} style={styles.field}>
              <Text selectable style={styles.text}>
                {scopeText(scope)}
              </Text>
              {scope.root ? (
                <Text selectable style={styles.muted}>
                  {scope.root}
                </Text>
              ) : null}
              {match ? <Text style={styles.muted}>{match}</Text> : null}
            </View>
          );
        })}
        <View style={styles.field}>
          <Text style={styles.label}>Timing</Text>
          <Text style={styles.text}>{timeLabel(memory)}</Text>
        </View>
      </Section>

      {memory.revisions.length > 0 ? (
        <Section styles={styles} title="Replacement history">
          {memory.revisions.map((revision) => (
            <RevisionRow
              key={revision.id}
              styles={styles}
              revision={revision}
              onPress={() => onOpen({ kind: "memory", id: revision.id })}
            />
          ))}
          <Text style={styles.muted}>
            Older and newer versions are history. A newer version does not by itself show what applies now. This
            lists the direct links only; the full chain is under Explore connections.
          </Text>
        </Section>
      ) : null}

      <Section styles={styles} title="Asserted by and source">
        <Text selectable style={styles.text}>
          {assertedBy}
        </Text>
        <Text style={styles.muted}>{assertionLabel(memory.assertionKind)}</Text>
        {memory.sourceRef ? (
          <Text selectable style={styles.text}>
            {memory.sourceRef}
          </Text>
        ) : (
          <Text style={styles.muted}>No source recorded.</Text>
        )}
        <Text style={styles.muted}>Source not checked. This panel does not open memory sources.</Text>
      </Section>

      <Section styles={styles} title="Advanced">
        <View style={styles.actions}>
          <Action
            styles={styles}
            label={showDetails ? "Hide details" : "Show details"}
            onPress={() => setShowDetails((open) => !open)}
          />
        </View>

        {showDetails ? (
          <>
            <DetailRow styles={styles} label="Memory ID" value={memory.id} />
            <DetailRow styles={styles} label="Status" value={statusLabel(memory.status)} />
            <DetailRow
              styles={styles}
              label="Starts"
              value={memory.validFrom ? formatDate(memory.validFrom) : "Unknown"}
            />
            <DetailRow
              styles={styles}
              label="Ends"
              value={memory.validTo ? formatDate(memory.validTo) : "No declared end"}
            />
            <DetailRow styles={styles} label="Recorded" value={formatDate(memory.createdAt)} />
            <DetailRow styles={styles} label="Last changed" value={formatDate(memory.updatedAt)} />
            <DetailRow
              styles={styles}
              label="Scope IDs"
              value={memory.scopes.map((scope) => scope.id).join(", ") || "None"}
            />
            <DetailRow styles={styles} label="Asserted by ID" value={memory.assertedBy} />
            {memory.subjectId ? <DetailRow styles={styles} label="About ID" value={memory.subjectId} /> : null}
          </>
        ) : null}
      </Section>

      <Text style={styles.muted}>
        To add this memory to a prompt, choose Memory in the message box attachment picker. Adding it does not send
        the message.
      </Text>
    </ScrollView>
  );
}

function DetailRow({ styles, label, value }: { styles: MemoryStyles; label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.text}>
        {value}
      </Text>
    </View>
  );
}
