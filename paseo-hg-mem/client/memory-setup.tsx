import { useEffect, useState } from "react";
import { View } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { memorySettings, type MemorySettings } from "../shared/settings";
import { useHostState, useInitializeMemory, useInstallMemorySkills, useMemoryCatalog, useMemoryStatus, useMemoryVerify } from "./hooks";
import { errorMessage } from "./labels";

export function MemorySetup({ host }: PluginSurfaceProps) {
  const online = useHostState(host.id) === "online";
  const settings = useSettings(memorySettings);
  const status = useMemoryStatus(host.id, online);
  const health = status.data;
  const verify = useMemoryVerify();
  const initialize = useInitializeMemory(host.id);
  const installSkills = useInstallMemorySkills(host.id);
  const catalog = useMemoryCatalog(host.id, online && health?.state === "ready");

  const saved = settings.status === "ready" ? settings.values : null;
  const revision = settings.status === "ready" || settings.status === "invalid" ? settings.revision : null;
  const [draft, setDraft] = useState<MemorySettings | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Seed the draft once from the saved values. After that the draft is only changed by the user,
  // so a failed save, a conflict or a reload never discards what they typed.
  useEffect(() => {
    if (draft === null && saved !== null) setDraft(saved);
  }, [draft, saved]);

  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const savedOperatorReady = saved !== null && saved.operatorId.trim() !== "" && saved.operatorName.trim() !== "";
  const scopeName = (id: string) => catalog.data?.scopes.find((scope) => scope.id === id)?.name ?? id;

  function patch(change: Partial<MemorySettings>) {
    setNote(null);
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  async function save() {
    if (draft === null || revision === null) return;
    const ok = await settings.save(draft, revision);
    setNote(ok ? "Setup saved. Saving does not create or change the memory store." : null);
    if (ok) {
      // Health depends on the saved paths, so re-read it. The old check result no longer applies.
      verify.reset();
      await status.refetch();
    }
  }

  async function resetSettings() {
    setConfirmReset(false);
    const ok = await settings.reset();
    if (ok) {
      setDraft(null);
      setNote("Reset to defaults. Review the values before saving.");
    }
  }

  function createStore() {
    setNote(null);
    initialize.mutate(undefined, {
      onSuccess: (result) => {
        setNote(result.message);
        verify.reset();
      },
    });
  }

  async function checkSetup() {
    // Run the integrity check only against a store that reports ready. Otherwise show the setup state.
    const fresh = await status.refetch();
    if (!fresh.isError && fresh.data?.state === "ready") {
      verify.mutate(undefined);
    } else {
      verify.reset();
    }
  }

  const statusProblem = status.isError || health?.state === "error";
  const statusText = health?.message ?? (status.isError ? errorMessage(status.error) : "Checking the memory store…");
  const saveHint = !online
    ? "Reconnect to save."
    : dirty
      ? "Unsaved changes. Saving does not create or change the memory store."
      : "No unsaved changes.";
  const createHint = !savedOperatorReady
    ? "Enter and save the operator name and identifier first."
    : dirty
      ? "Save your setup changes first."
      : "Creates the store at the memory file location. Blank uses the suggested location.";

  return (
    <View>
      {!online ? (
        <SettingsSection title="Host">
          <SettingsCard>
            <SettingsRow label={`${host.label} is offline`} hint="Reconnect to read or change this host's memory setup." />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      <SettingsSection title="Memory store">
        <SettingsCard>
          <SettingsRow
            label="Status"
            hint={statusProblem ? undefined : statusText}
            error={statusProblem ? statusText : null}
          />
          <SettingsRow
            label="Memories"
            hint={health?.state === "ready" ? `${health.memoryCount} stored` : "Available after setup."}
          />
          <SettingsRow
            label="Skills"
            hint={
              health
                ? health.skillsInstalled
                  ? "Current in this host's agent discovery folders."
                  : "Install or update the skills for agents on this host."
                : "Checking…"
            }
          />
          <SettingsAction
            label="Install or update memory skills"
            hint="Publishes skills to the primary folder and agent discovery folders on this host. Archives recognized old copies. Modified current skills block installation; modified old copies are kept. Does not change memories. Save setup changes first."
            actionLabel={installSkills.isPending ? "Installing…" : "Install / update"}
            onPress={() => installSkills.mutate()}
            disabled={!online || dirty || saved === null || installSkills.isPending || settings.saving || initialize.isPending}
            error={installSkills.isError ? errorMessage(installSkills.error) : null}
          />
          {installSkills.data ? (
            <>
              <SettingsRow label="Last skill installation" hint={installSkills.data.message} />
              {installSkills.data.directories.map(directory => <SettingsRow key={directory} label="Last installed in" hint={directory} />)}
              {installSkills.data.migrated.length ? <SettingsRow label="Old skills archived" hint={`${installSkills.data.migrated.length} recognized copies moved to plugin backups.`} /> : null}
              {installSkills.data.warnings.map(warning => <SettingsRow key={warning} label="Installation note" hint={warning} />)}
            </>
          ) : null}
          {verify.data ? (
            <SettingsRow
              label="Last check"
              hint={verify.data.ok ? verify.data.message : undefined}
              error={verify.data.ok ? null : verify.data.message}
            />
          ) : null}
          {verify.isError ? <SettingsRow label="Last check" error={errorMessage(verify.error)} /> : null}
          <SettingsAction
            label="Check setup"
            hint="Checks store and search integrity without editing memories."
            actionLabel="Check"
            onPress={() => void checkSetup()}
            disabled={!online || verify.isPending}
          />
          {health?.state === "setup" ? (
            <SettingsAction
              label="Create memory store"
              hint={createHint}
              actionLabel="Create"
              onPress={createStore}
              disabled={!online || dirty || !savedOperatorReady || initialize.isPending}
              error={initialize.isError ? errorMessage(initialize.error) : null}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>

      {settings.status === "invalid" ? (
        <SettingsSection title="Saved setup">
          <SettingsCard>
            <SettingsRow
              label="Unreadable setup"
              hint="Your saved values are kept until you reset them."
              error={errorMessage(settings.error)}
            />
            <SettingsAction
              label="Reset to defaults"
              hint="Replaces the unreadable saved setup with defaults."
              actionLabel={confirmReset ? "Confirm reset" : "Reset"}
              onPress={confirmReset ? () => void resetSettings() : () => setConfirmReset(true)}
              disabled={!online || settings.saving}
            />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {settings.status === "error" ? (
        <SettingsSection title="Saved setup">
          <SettingsCard>
            <SettingsRow label="Could not read setup" error={errorMessage(settings.error)} />
            <SettingsAction
              label="Retry"
              hint="Reads the saved setup again."
              actionLabel="Retry"
              onPress={() => void settings.reload()}
              disabled={!online}
            />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {draft === null && settings.status === "loading" ? (
        <SettingsSection title="Setup">
          <SettingsCard>
            <SettingsRow label="Loading saved setup…" />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {draft !== null ? (
        <>
          <SettingsSection title="Runtime">
            <SettingsCard>
              <SettingsInput
                label="Memory file"
                hint="Where the memory store lives on this host. Blank uses the suggested location."
                placeholder={health?.suggestedDatabasePath}
                initialValue={draft.databasePath}
                onChangeText={(text) => patch({ databasePath: text })}
                disabled={!online}
              />
              <SettingsInput
                label="Database tool"
                hint="Blank uses the suggested tool."
                placeholder={health?.suggestedSqlitePath}
                initialValue={draft.sqlitePath}
                onChangeText={(text) => patch({ sqlitePath: text })}
                disabled={!online}
              />
              <SettingsInput
                label="Memory extension"
                hint="Blank uses the suggested extension."
                placeholder={health?.suggestedExtensionPath}
                initialValue={draft.extensionPath}
                onChangeText={(text) => patch({ extensionPath: text })}
                disabled={!online}
              />
              <SettingsInput
                label="Skills folder"
                hint="Primary skill files used by agent sessions. Install / update also publishes them to this host's agent discovery folders. Blank uses the default."
                initialValue={draft.skillsDirectory}
                onChangeText={(text) => patch({ skillsDirectory: text })}
                disabled={!online}
              />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Operator">
            <SettingsCard>
              <SettingsInput
                label="Operator name"
                hint="Required. Shown as who asserted memories entered in Paseo."
                initialValue={draft.operatorName}
                onChangeText={(text) => patch({ operatorName: text })}
                disabled={!online}
              />
              <SettingsInput
                label="Operator identifier"
                hint="Required. A short stable ID such as operator:jane. Changing it does not rewrite existing memories."
                placeholder="operator:name"
                initialValue={draft.operatorId}
                onChangeText={(text) => patch({ operatorId: text })}
                disabled={!online}
              />
              {savedOperatorReady ? null : (
                <SettingsRow label="Operator" hint="Not set yet. Enter a name and identifier, then save." />
              )}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Workspace context">
            <SettingsCard>
              <SettingsSwitch
                label="Memory on this host"
                hint="Turns memory on or off for this host."
                value={draft.enabled}
                onValueChange={(value) => patch({ enabled: value })}
                disabled={!online}
              />
              <SettingsSwitch
                label="Agent integration"
                hint="Offer memory to agents when sessions open. Turn off to explore the panel without adding memory to agent sessions."
                value={draft.agentIntegrationEnabled}
                onValueChange={(value) => patch({ agentIntegrationEnabled: value })}
                disabled={!online}
              />
              {Object.keys(draft.projectBindings).length === 0 ? (
                <SettingsRow
                  label="Project bindings"
                  hint="None yet. A binding connects a Paseo project to the memory scopes it reads."
                />
              ) : (
                Object.entries(draft.projectBindings).map(([projectId, scopeIds]) => (
                  <SettingsRow
                    key={projectId}
                    label={`Project ${projectId}`}
                    hint={scopeIds.map(scopeName).join(", ") || "No scopes"}
                  />
                ))
              )}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Save">
            <SettingsCard>
              <SettingsAction
                label="Save setup"
                hint={saveHint}
                actionLabel="Save"
                onPress={() => void save()}
                disabled={!online || !dirty || revision === null || settings.saving}
                error={settings.saveError ? errorMessage(settings.saveError) : null}
              />
              {settings.saveError ? (
                <SettingsAction
                  label="Reload saved values"
                  hint="Your draft stays here. Compare, then save again."
                  actionLabel="Reload"
                  onPress={() => void settings.reload()}
                  disabled={!online}
                />
              ) : null}
              {note ? <SettingsRow label="Latest change" hint={note} /> : null}
            </SettingsCard>
          </SettingsSection>
        </>
      ) : null}
    </View>
  );
}
