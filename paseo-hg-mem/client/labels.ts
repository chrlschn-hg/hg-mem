import type { GraphNode, MemoryRecord, RevisionRef } from "../shared/contracts";

export type Purpose = MemoryRecord["purpose"];

export const PURPOSE_OPTIONS: ReadonlyArray<{ value: Purpose; label: string; hint: string }> = [
  {
    value: "Persona",
    label: "About me",
    hint: "About you, the operator: preferences, working style or facts about you.",
  },
  {
    value: "Operational",
    label: "Project knowledge",
    hint: "How this project or directory works. It needs a topic to be filed under.",
  },
  {
    value: "CAPA",
    label: "Correction or prevention",
    hint: "A fix for a mistake, so it is not repeated. This does not make it an instruction.",
  },
];

export function purposeLabel(purpose: Purpose): string {
  return PURPOSE_OPTIONS.find((option) => option.value === purpose)?.label ?? purpose;
}

// Topic chips show the topic name; the kind is appended only when it adds information.
export function topicLabel(topic: { name: string; label: string }): string {
  return topic.label && topic.label !== topic.name ? `${topic.name} (${topic.label})` : topic.name;
}

export function scopeNames(record: MemoryRecord): string {
  const names = record.scopes.map((scope) => scope.name).filter((name) => name.length > 0);
  return names.length > 0 ? names.join(" · ") : "No scope recorded";
}

// Scope kinds read as words. The global scope reads as its name; the others read as kind and name, e.g. "Directory hg-mem".
const SCOPE_KIND_LABELS: Record<string, string> = {
  global: "Global",
  project: "Project",
  directory: "Directory",
  session: "Session",
};

export function scopeText(scope: { name: string; kind: string }): string {
  if (scope.kind === "global") return scope.name;
  return `${SCOPE_KIND_LABELS[scope.kind] ?? scope.kind} ${scope.name}`;
}

// Rows say what a memory applies to inside their purpose line.
export function appliesLabel(record: MemoryRecord): string {
  return record.scopes.length > 0
    ? `Applies to: ${record.scopes.map((scope) => scopeText(scope)).join(", ")}`
    : "No scope recorded";
}

// Scope match is a separate fact from time. A null match was not checked, so it says nothing.
export function matchLabel(matched: boolean | null): string | null {
  if (matched === null) return null;
  return matched ? "Scope matches this workspace" : "Scope does not match this workspace";
}

export function assertionLabel(kind: string): string {
  switch (kind) {
    case "explicit":
      return "Explicit";
    case "observed":
      return "Observed";
    case "inferred":
      return "Inferred · Not an explicit operator instruction";
    default:
      return kind;
  }
}

export function statusLabel(status: MemoryRecord["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "retired":
      return "No longer active";
    case "retracted":
      return "Withdrawn as mistaken";
  }
}

export type TimeKind = "withdrawn" | "ended" | "future" | "unknown-start" | "in-effect";

type Timed = Pick<MemoryRecord, "status" | "validity" | "validFrom" | "validTo">;

// Display only. Status and dates say what is in effect in time, never whether it applies in a given scope.
export function timeState(item: Timed, now = Date.now()): { kind: TimeKind; label: string } {
  if (item.status === "retracted" || item.validity === "RETRACTED") {
    return { kind: "withdrawn", label: "Withdrawn as mistaken" };
  }
  if (item.status === "retired" || (item.validTo !== null && Date.parse(item.validTo) <= now)) {
    return {
      kind: "ended",
      label: item.validTo ? `No longer active · Ended ${formatDate(item.validTo)}` : "No longer active",
    };
  }
  if (item.validFrom !== null && Date.parse(item.validFrom) > now) {
    return { kind: "future", label: `Not yet in effect · Starts ${formatDate(item.validFrom)}` };
  }
  if (item.validFrom === null) return { kind: "unknown-start", label: "May apply · Start date unknown" };
  return { kind: "in-effect", label: "In effect now" };
}

export function timeLabel(record: MemoryRecord): string {
  return timeState(record).label;
}

// Row badge for records that are not current in time. Future and unknown-start records get their own states.
export function historicalTag(record: MemoryRecord): string | null {
  const kind = timeState(record).kind;
  if (kind === "withdrawn") return "Withdrawn";
  if (kind === "ended") return "No longer active";
  if (kind === "future") return "Not yet in effect";
  return null;
}

export function excerpt(content: string, limit = 180): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString();
}

export function directoryName(directory: string): string {
  const parts = directory.split(/[\\/]/).filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? directory;
}

// The SDK wraps plugin RPC failures as "Request failed: <message> requestType=... code=...".
// Show only the actionable message the handler wrote.
const SDK_WRAPPER_PREFIX = /^(?:Error:\s*)?Request failed:\s*/i;
const SDK_WRAPPER_METADATA = /\s*\b(?:requestType|requestId|serverId|code|method)=\S+/g;
const FALLBACK_MESSAGE = "Something went wrong. Try again.";

export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const inner = raw.replace(SDK_WRAPPER_PREFIX, "").replace(SDK_WRAPPER_METADATA, "").trim();
  return inner.length > 0 ? inner : FALLBACK_MESSAGE;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// A filing path, top to leaf. Rows keep the leaf visible; the detail and explorer show every level.
export function pathLabel(nodes: GraphNode[], abbreviate = false): string {
  const names = nodes.map((node) => node.name);
  if (abbreviate && names.length > 2) return `${names[0]} › … › ${names[names.length - 1]}`;
  return names.join(" › ");
}

// One filed-under or About line per row. It never fills an absent level and never implies applicability.
export function rowLinkLine(record: MemoryRecord): string | null {
  if (record.filingPath.length > 0) return `Filed under: ${pathLabel(record.filingPath, true)}`;
  if (record.subject) return `About: ${record.subject.name}`;
  return null;
}

export function revisionDirectionLabel(direction: RevisionRef["direction"]): string {
  return direction === "predecessor" ? "Replaces (older)" : "Replaced by (newer)";
}

// A version's state is its own stored status and dates, shown as they are. A link never makes it current.
export function revisionStateLabel(revision: RevisionRef): string {
  return timeState(revision).label;
}

// Historical records say what they are before any content. Future and unknown-start records get no banner.
export function historyBanner(record: MemoryRecord): { title: string; body: string } | null {
  const state = timeState(record);
  if (state.kind === "withdrawn") return { title: state.label, body: "Kept as evidence. Not current guidance." };
  if (state.kind === "ended") return { title: state.label, body: "Kept as history. Not current guidance." };
  return null;
}
