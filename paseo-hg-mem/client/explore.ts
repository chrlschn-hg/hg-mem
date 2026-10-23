import type { GraphNode, MemoryRecord } from "../shared/contracts";
import { historicalTag, pathLabel, purposeLabel } from "./labels";
import type { Connection, ExplorePane } from "./types";

// A memory's channels: its filed-under node, its operator subject, and its version history. Each starts from the memory.
export function connectionsFor(memory: MemoryRecord): Connection[] {
  const revisions: Connection = {
    relation: "revisions",
    id: memory.id,
    target: { id: memory.id, name: memory.title, label: "Memory" },
    path: [],
  };
  // A record that is no longer current is not an eligible seed for filing or subject, so its explorer offers only its
  // own history. The filed-under and About breadcrumbs still seed from their nodes.
  if (historicalTag(memory) !== null || memory.validity === "INACTIVE" || memory.validity === "RETRACTED") {
    return [revisions];
  }
  const connections: Connection[] = [];
  const leaf = memory.filingPath[memory.filingPath.length - 1];
  if (leaf) connections.push({ relation: "filing", id: memory.id, target: leaf, path: memory.filingPath });
  if (memory.subject) connections.push({ relation: "subject", id: memory.id, target: memory.subject, path: [] });
  connections.push(revisions);
  return connections;
}

// A filed-under crumb. The explorer seeds from that node, so its members are the memories filed under it.
export function filingCrumb(path: GraphNode[], index: number): Connection {
  const target = path[index];
  return { relation: "filing", id: target.id, target, path: path.slice(0, index + 1) };
}

// An operator named in the detail. The explorer seeds from that operator node.
export function subjectNode(subject: GraphNode): Connection {
  return { relation: "subject", id: subject.id, target: subject, path: [] };
}

// Explore connections from a memory: every channel as a choice, opened on the active one.
export function memoryExplorer(memory: MemoryRecord, active: Connection): ExplorePane {
  return {
    kind: "explore",
    title: memory.title,
    subtitle: purposeLabel(memory.purpose),
    active,
    connections: connectionsFor(memory),
    offset: 0,
    expanded: false,
  };
}

// A crumb or operator: one channel, seeded at that node.
export function nodeExplorer(active: Connection): ExplorePane {
  return {
    kind: "explore",
    title: active.target.name,
    subtitle: active.path.length > 0 ? `${active.target.label} · ${pathLabel(active.path)}` : active.target.label,
    active,
    connections: [active],
    offset: 0,
    expanded: false,
  };
}

// Switching channels keeps the title and the choices, and starts the new channel from its first page.
export function switchChannel(pane: ExplorePane, active: Connection): ExplorePane {
  return { ...pane, active, offset: 0, expanded: false };
}

// Chip and heading text: the channel and the named thing it reaches.
export function channelLabel(connection: Connection): string {
  if (connection.relation === "filing") return `Filed under ${connection.target.name}`;
  if (connection.relation === "subject") return `About ${connection.target.name}`;
  return "Replacement history";
}
