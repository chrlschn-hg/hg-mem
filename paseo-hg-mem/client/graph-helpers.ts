import type { MemoryRecord } from "../shared/contracts";
import type { MemoryGraphNode } from "./graph-model";
import { pathLabel, purposeLabel, type Purpose } from "./labels";
import type { GraphExpansion } from "./types";

// Each page of an expansion asks for this many rows. "Load more" fetches the next page at the loaded offset.
export const EXPANSION_LIMIT = 20;
export const EXPANSION_DEADLINE_MS = 20_000;

// A memory node is kind-labelled by its purpose, or "Memory" for a superseded version. Everything else is context.
const MEMORY_KINDS = new Set(["Persona", "Operational", "CAPA", "Memory"]);
const CONTEXT_LABELS: Record<string, string> = { Domain: "Domain", Area: "Area", Topic: "Topic", Operator: "Operator" };

export function isMemoryNode(node: MemoryGraphNode): boolean {
  return MEMORY_KINDS.has(node.kind);
}

// Operators expand by subject, meaning the memories they are about. Taxonomy nodes expand by filing.
export function relationFor(node: MemoryGraphNode): "filing" | "subject" {
  return node.kind === "Operator" ? "subject" : "filing";
}

export function typeLabel(node: MemoryGraphNode): string {
  if (node.kind === "Memory") return node.historical ? "Historical memory" : "Memory";
  if (isMemoryNode(node)) return purposeLabel(node.kind as Purpose);
  return CONTEXT_LABELS[node.kind] ?? node.kind;
}

// The current page first, then every expansion's loaded rows, each record once. The builder reserves page rows first.
export function mergeRecords(page: readonly MemoryRecord[], expansions: readonly GraphExpansion[]): MemoryRecord[] {
  const seen = new Set<string>();
  const merged: MemoryRecord[] = [];
  const pool = [...page, ...expansions.flatMap((entry) => entry.items)];
  for (const record of pool) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    merged.push(record);
  }
  return merged;
}

// The actual filing chain down to a context node, read from a loaded memory filed under it.
export function ancestryFor(nodeId: string, records: readonly MemoryRecord[]): string | null {
  for (const record of records) {
    const index = record.filingPath.findIndex((part) => part.id === nodeId);
    if (index >= 0) return pathLabel(record.filingPath.slice(0, index + 1));
  }
  return null;
}

// Rejects after a deadline, so an expansion can never leave the inspector loading forever.
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The request took too long. Try again.")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
