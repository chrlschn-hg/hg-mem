import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import type { MemoryRecord } from "../shared/contracts";
import type { MemoryCatalog } from "./hooks";
import { directoryName, errorMessage, PURPOSE_OPTIONS, scopeNames, topicLabel } from "./labels";
import { Action, Chip, Section } from "./parts";
import type { CreateDraft, PanelUi } from "./types";

type MemoryCreateProps = {
  ui: PanelUi;
  narrow: boolean;
  draft: CreateDraft;
  catalog: UseQueryResult<MemoryCatalog>;
  resolvedFilingId: string | null;
  saving: boolean;
  saveError: string | null;
  saved: MemoryRecord | null;
  problem: string | null;
  onDraft(patch: Partial<CreateDraft>): void;
  onSubmit(): void;
  onCancel(): void;
  onClearDraft(): void;
  onViewSaved(): void;
  onDismissSaved(): void;
  onCheckTitle(): void;
  // Layout beside the heading in a single-pane inspector, and its choices directly under the heading when open.
  layoutTrigger?: ReactNode;
  layoutChoices?: ReactNode;
};

// While a save is in flight every draft control is frozen, so the success path clears exactly what was submitted.
export function MemoryCreate({
  ui,
  narrow,
  draft,
  catalog,
  resolvedFilingId,
  saving,
  saveError,
  saved,
  problem,
  onDraft,
  onSubmit,
  onCancel,
  onClearDraft,
  onViewSaved,
  onDismissSaved,
  onCheckTitle,
  layoutTrigger,
  layoutChoices,
}: MemoryCreateProps) {
  const { styles, theme, directory, operatorName } = ui;
  const placeholderColor = theme.colors.foregroundMuted;
  const scopeLabel = draft.scope === "workspace" ? "This directory" : "Everywhere";
  const purposeHint = PURPOSE_OPTIONS.find((option) => option.value === draft.purpose)?.hint ?? "";
  const topics = catalog.data?.filing ?? [];

  return (
    <ScrollView
      style={[styles.scroll, styles.formScroll]}
      contentContainerStyle={[styles.scrollContent, styles.formContent]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.detailTop}>
        <Text style={styles.heading}>New memory</Text>
        {layoutTrigger}
      </View>
      {layoutChoices}

      {saved ? (
        <View style={styles.card}>
          <Text style={styles.success}>Saved</Text>
          <Text style={styles.text}>{saved.title}</Text>
          <Text style={styles.muted}>
            {scopeNames(saved)} · Asserted by {operatorName}
          </Text>
          <View style={styles.actions}>
            <Action styles={styles} label="View memory" onPress={onViewSaved} />
            <Action styles={styles} tone="link" label="Dismiss" onPress={onDismissSaved} />
          </View>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>What should be remembered?</Text>
        <TextInput
          value={draft.content}
          onChangeText={(content) => onDraft({ content })}
          editable={!saving}
          multiline
          placeholder="Write the memory in full"
          placeholderTextColor={placeholderColor}
          accessibilityLabel="What should be remembered"
          style={[styles.input, styles.inputMultiline]}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Short title</Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => onDraft({ title })}
          editable={!saving}
          maxLength={300}
          placeholder="A few words"
          placeholderTextColor={placeholderColor}
          accessibilityLabel="Short title"
          style={styles.input}
        />
      </View>

      <Section styles={styles} title="Purpose">
        <View style={styles.row}>
          {PURPOSE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              styles={styles}
              label={option.label}
              selected={draft.purpose === option.value}
              disabled={saving}
              onPress={() => onDraft({ purpose: option.value })}
            />
          ))}
        </View>
        <Text style={styles.muted}>{purposeHint}</Text>
      </Section>

      <Section styles={styles} title="Applies to">
        <View style={styles.row}>
          <Chip
            styles={styles}
            label="This directory"
            selected={draft.scope === "workspace"}
            disabled={saving}
            onPress={() => onDraft({ scope: "workspace" })}
          />
          <Chip
            styles={styles}
            label="Everywhere"
            selected={draft.scope === "global"}
            disabled={saving}
            onPress={() => onDraft({ scope: "global" })}
          />
        </View>
        {draft.scope === "workspace" ? (
          <Text selectable style={styles.muted}>
            {directoryName(directory)} · {directory}
          </Text>
        ) : (
          <Text style={styles.muted}>Applies in every workspace. Choose this on purpose, not as a fallback.</Text>
        )}
      </Section>

      <Section styles={styles} title="Treat as an instruction">
        <View style={styles.row}>
          <Chip
            styles={styles}
            label="No"
            selected={!draft.required}
            disabled={saving}
            onPress={() => onDraft({ required: false })}
          />
          <Chip
            styles={styles}
            label="Yes, required"
            selected={draft.required}
            disabled={saving}
            onPress={() => onDraft({ required: true })}
          />
        </View>
        <Text style={styles.muted}>
          Required instructions are listed under Instructions. The purpose does not decide this.
        </Text>
      </Section>

      {draft.purpose === "Operational" ? (
        <Section styles={styles} title="Filed under">
          {catalog.isPending ? <Text style={styles.muted}>Loading topics…</Text> : null}
          {catalog.isError ? (
            <View style={styles.field}>
              <Text style={styles.danger}>Could not load topics. {errorMessage(catalog.error)}</Text>
              <Action styles={styles} tone="link" label="Try again" onPress={() => void catalog.refetch()} />
            </View>
          ) : null}
          {catalog.isSuccess && topics.length === 0 ? (
            <Text style={styles.danger}>This memory store has no topics yet, so project knowledge cannot be filed.</Text>
          ) : null}
          {topics.length > 0 ? (
            <View style={styles.row}>
              {topics.map((topic) => (
                <Chip
                  key={topic.id}
                  styles={styles}
                  label={topicLabel(topic)}
                  selected={resolvedFilingId === topic.id}
                  disabled={saving}
                  onPress={() => onDraft({ filingId: topic.id })}
                />
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>{draft.required ? "Source (required)" : "Source (optional)"}</Text>
        <TextInput
          value={draft.sourceRef}
          onChangeText={(sourceRef) => onDraft({ sourceRef })}
          editable={!saving}
          autoCapitalize="none"
          placeholder="A document, ticket or link"
          placeholderTextColor={placeholderColor}
          accessibilityLabel="Source, optional"
          style={styles.input}
        />
        <Text style={styles.muted}>
          {draft.required
            ? "Required instructions need a source: a document, ticket or link."
            : "Leave blank if there is none. Paseo does not fill this in for you."}
        </Text>
      </View>

      {problem ? <Text style={styles.danger}>{problem}</Text> : null}

      {saveError ? (
        <View style={styles.field}>
          <Text style={styles.danger}>Save not confirmed. Your draft is still here. {saveError}</Text>
          <Text style={styles.muted}>
            It may have been stored anyway. Search for the title to check before you save again.
          </Text>
          <Action styles={styles} tone="link" label="Search for this title" onPress={onCheckTitle} />
        </View>
      ) : null}

      {narrow ? (
        <View style={styles.stack}>
          <View style={styles.fullWidth}>
            <Action
              styles={styles}
              tone="primary"
              label={saving ? "Saving…" : `Save memory · ${scopeLabel}`}
              onPress={onSubmit}
              disabled={saving}
            />
          </View>
          <View style={styles.footerRow}>
            <Action styles={styles} label="Cancel" onPress={onCancel} disabled={saving} />
            <Action styles={styles} tone="link" label="Clear draft" onPress={onClearDraft} disabled={saving} />
          </View>
        </View>
      ) : (
        <View style={styles.footerRow}>
          <View style={styles.actions}>
            <Action
              styles={styles}
              tone="primary"
              label={saving ? "Saving…" : `Save memory · ${scopeLabel}`}
              onPress={onSubmit}
              disabled={saving}
            />
            <Action styles={styles} label="Cancel" onPress={onCancel} disabled={saving} />
          </View>
          <Action styles={styles} tone="link" label="Clear draft" onPress={onClearDraft} disabled={saving} />
        </View>
      )}
      <Text style={styles.muted}>Saving records only what you enter here. It does not send anything to an agent.</Text>
    </ScrollView>
  );
}
