import type { MemoryRecord } from "../shared/contracts";

export const GRAPH_NODE_LIMIT = 120;

export type MemoryGraphNode = {
  id: string;
  label: string;
  kind: string;
  status?: string;
  historical?: boolean;
  required?: boolean;
  validity?: string;
};

export type MemoryGraphEdge = { id: string; source: string; target: string; label: string };
export type MemoryGraphData = { nodes: MemoryGraphNode[]; edges: MemoryGraphEdge[]; omitted: number };

// Only factual edges returned in a record envelope are drawn. Scope is an attribute, never a hub.
// Filing paths arrive root-first; CHILD_OF points in the opposite direction, from child to parent.
export function buildMemoryGraph(records: readonly MemoryRecord[], limit = GRAPH_NODE_LIMIT): MemoryGraphData {
  const nodes = new Map<string, MemoryGraphNode>();
  const edges = new Map<string, MemoryGraphEdge>();
  const omitted = new Set<string>();
  const maximum = Math.max(0, Math.min(GRAPH_NODE_LIMIT, Math.floor(limit)));
  function node(value: MemoryGraphNode) {
    if (nodes.has(value.id)) return;
    if (nodes.size >= maximum) { omitted.add(value.id); return; }
    nodes.set(value.id, value);
  }
  function edge(source: string, label: string, target: string) {
    if (!nodes.has(source) || !nodes.has(target)) return;
    const id = JSON.stringify([source, label, target]);
    edges.set(id, { id, source, label, target });
  }

  // Reserve space for actual results before attaching any context or revision references.
  for (const memory of records) node({ id: memory.id, label: memory.title, kind: memory.purpose,
    status: memory.status, required: memory.required, validity: memory.validity });
  for (const memory of records) {
    if (!nodes.has(memory.id)) continue;
    const path = memory.filingPath;
    for (const part of path) node({ id: part.id, label: part.name, kind: part.label });
    for (let index = 1; index < path.length; index++) edge(path[index].id, "CHILD_OF", path[index - 1].id);
    const leaf = path[path.length - 1];
    if (leaf) edge(memory.id, "FILED_UNDER", leaf.id);
    if (memory.subject) {
      node({ id: memory.subject.id, label: memory.subject.name, kind: memory.subject.label });
      edge(memory.id, "ABOUT", memory.subject.id);
    }
    for (const revision of memory.revisions) {
      node({ id: revision.id, label: revision.title, kind: "Memory", status: revision.status,
        validity: revision.validity, historical: true });
      // Per-hit references are direct only. Never turn a multihop history reference into a direct edge.
      if (revision.depth === 1) {
        if (revision.direction === "predecessor") edge(memory.id, "SUPERSEDES", revision.id);
        else edge(revision.id, "SUPERSEDES", memory.id);
      }
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], omitted: omitted.size };
}
