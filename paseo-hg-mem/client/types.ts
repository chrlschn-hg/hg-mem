import type { PluginTheme } from "@getpaseo/plugin";
import type { ExploreRelation, GraphNode, MemoryContext, MemoryRecord } from "../shared/contracts";
import type { Purpose } from "./labels";
import type { ScrollMemory } from "./scroll-memory";
import type { MemoryStyles } from "./styles";

export const PAGE_SIZE = 30;
export const PREVIEW_SIZE = 5;

export type PanelMode = "memories" | "instructions" | "help";

// The Memories region shows the search list, or the graph of the same results page.
export type ResultView = "list" | "graph";

export type ScopeChoice = "workspace" | "global";

export type CreateDraft = {
  title: string;
  content: string;
  purpose: Purpose;
  scope: ScopeChoice;
  required: boolean;
  filingId: string | null;
  sourceRef: string;
};

export const EMPTY_DRAFT: CreateDraft = {
  title: "",
  content: "",
  purpose: "Operational",
  scope: "workspace",
  required: false,
  filingId: null,
  sourceRef: "",
};

// One explicit expansion of a context node through memory.explore. Ready expansions add their records to the graph.
export type GraphExpansion = {
  relation: "filing" | "subject";
  status: "loading" | "ready" | "error";
  items: MemoryRecord[];
  total: number;
  error: string | null;
};

// Graph state lives in the panel, so a narrow detail covering the graph does not reset what the reader built.
// A new workspace, search, or page is a new generation: its expansions and selection are dropped, and any response
// still in flight for an older generation is discarded.
export type GraphState = {
  generation: string;
  selectedId: string | null;
  // Keyed by `${relation}:${nodeId}`.
  expansions: Record<string, GraphExpansion>;
};

export const EMPTY_GRAPH: GraphState = { generation: "", selectedId: null, expansions: {} };

// One channel into the graph. `id` is what the explorer queries: the memory for a memory's channels, or the node.
// `target` is what the channel names. `path` is the filing chain down to the target, for filing channels.
export type Connection = {
  relation: ExploreRelation;
  id: string;
  target: GraphNode;
  path: GraphNode[];
};

// The pane stack above the results list. Each pane keeps its own page and scroll while it is covered.
export type MemoryPane = { kind: "memory"; id: string };
export type ExplorePane = {
  kind: "explore";
  title: string;
  subtitle: string;
  active: Connection;
  connections: Connection[];
  offset: number;
  expanded: boolean;
};
export type Pane = MemoryPane | ExplorePane;

export type PanelUi = {
  styles: MemoryStyles;
  theme: PluginTheme;
  compact: boolean;
  hostId: string;
  context: MemoryContext;
  directory: string;
  operatorId: string;
  operatorName: string;
  scroll: ScrollMemory;
};
