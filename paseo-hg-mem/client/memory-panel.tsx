import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useRpc, useSettings, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useQueryClient } from "@tanstack/react-query";
import { memoryExplore, type MemoryDraft, type MemoryRecord } from "../shared/contracts";
import { memorySettings } from "../shared/settings";
import {
  MEMORY_KEY,
  memoryContext,
  useHostState,
  useMemoryBrowse,
  useMemoryCatalog,
  useMemoryDirectives,
  useMemoryStatus,
  useSaveMemory,
  useWorkspaceSummary,
} from "./hooks";
import { subscribeMemorySearch, takeMemorySearch } from "./intent";
import { directoryName, errorMessage } from "./labels";
import { buildMemoryGraph, type MemoryGraphData, type MemoryGraphNode } from "./graph-model";
import {
  ancestryFor,
  EXPANSION_DEADLINE_MS,
  EXPANSION_LIMIT,
  isMemoryNode,
  mergeRecords,
  relationFor,
  withDeadline,
} from "./graph-helpers";
import { ContextInspector } from "./graph-inspector";
import { MemoryBrowse } from "./memory-browse";
import { MemoryCreate } from "./memory-create";
import { MemoryDetail } from "./memory-detail";
import { MemoryExplore } from "./memory-explore";
import { MemoryGraph } from "./memory-graph";
import { MemoryHelp } from "./memory-help";
import { MemoryInstructions } from "./memory-instructions";
import { LayoutChoices, LayoutTrigger, MemoryToolbar, NodePicker, type OpenMenu } from "./memory-toolbar";
import { Action, Chip, StateBlock, focusControl } from "./parts";
import type { ScrollMemory } from "./scroll-memory";
import { createStyles } from "./styles";
import {
  EMPTY_DRAFT,
  EMPTY_GRAPH,
  PAGE_SIZE,
  type CreateDraft,
  type ExplorePane,
  type GraphExpansion,
  type GraphState,
  type PanelMode,
  type PanelUi,
  type Pane,
  type ResultView,
} from "./types";

// The shared inspector and the graph share a row only when the graph has room. Under this width the single pane shows.
const GRAPH_SPLIT_MIN_WIDTH = 900;
const LIST_SPLIT_MIN_WIDTH = 760;

export type MemoryPanelProps = PluginWorkspacePanelProps & { onOpenSetup(): void };

export function MemoryPanel({ workspaceId, host, theme, layout, onOpenSetup }: MemoryPanelProps) {
  const compact = layout.compact;
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  const hostState = useHostState(host.id);
  const online = hostState === "online";
  const workspace = useWorkspaceSummary(workspaceId);
  const directory = workspace?.directory ?? "";
  const context = useMemo(() => memoryContext(workspaceId, directory), [workspaceId, directory]);

  const settings = useSettings(memorySettings);
  // No default operator: an unset operator is shown as unset and blocks saving until setup names one.
  const operatorId = settings.status === "ready" ? settings.values.operatorId.trim() : "";
  const operatorName = settings.status === "ready" ? settings.values.operatorName.trim() : "";
  const operatorReady = operatorId !== "" && operatorName !== "";

  const connected = online && workspace !== null;
  const status = useMemoryStatus(host.id, connected);
  const usable = connected && status.data?.state === "ready";

  const [mode, setMode] = useState<PanelMode>("memories");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [instructionOffset, setInstructionOffset] = useState(0);
  // The row the reader opened from results. It keeps its highlight when Results clears the stack.
  const [anchorId, setAnchorId] = useState<string | null>(null);
  // Results in Memories: the search list, or the graph of the same page. Both read the same query and page.
  const [resultView, setResultView] = useState<ResultView>("list");
  // Layout: Auto follows the width. Split is the reader's explicit choice at every width.
  const [splitGraph, setSplitGraph] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  // The live announcement for a Layout choice. It changes only when the reader picks a layout.
  const [layoutNote, setLayoutNote] = useState("");
  // Measured panel size. Layout decisions use the width; the Nodes picker's cap uses the height.
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);
  // Focus for the inspector and the disclosure triggers. A choice unmounts the control that had focus, so the focus
  // effect moves it after that commit.
  const inspectorControl = useRef<View>(null);
  const nodesControl = useRef<View>(null);
  const layoutControl = useRef<View>(null);
  const pendingFocus = useRef<"inspector" | "layout" | null>(null);
  // Graph state lives here, so a narrow inspector covering the graph does not reset what the reader built.
  const [graph, setGraph] = useState<GraphState>(EMPTY_GRAPH);
  // Panes above the results, outermost first. An empty stack shows the results.
  const [stack, setStack] = useState<Pane[]>([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<MemoryRecord | null>(null);
  // Measured panel width drives the single-pane and split decisions.
  const [width, setWidth] = useState<number | null>(null);
  // Scroll offsets survive while a pane is covered, so Back lands where the reader was.
  const scrollMemory = useMemo<ScrollMemory>(() => new Map(), []);

  const explore = useRpc(memoryExplore);
  const queryClient = useQueryClient();

  const page = useMemoryBrowse(host.id, context, query, offset, PAGE_SIZE, usable);
  const pageRecords = useMemo(() => page.data?.items ?? [], [page.data]);
  const requiredCount = useMemoryDirectives(host.id, context, 0, 1, usable);
  const instructions = useMemoryDirectives(
    host.id,
    context,
    instructionOffset,
    PAGE_SIZE,
    usable && mode === "instructions",
  );
  const catalog = useMemoryCatalog(host.id, usable && creating);
  const save = useSaveMemory(host.id, context);

  const commitQuery = useCallback((next: string) => {
    setQuery(next);
    setOffset(0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => commitQuery(searchText.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchText, commitQuery]);

  // The /memory command and Command Center hand over a search for this workspace.
  useEffect(() => {
    const apply = () => {
      const requested = takeMemorySearch(workspaceId);
      if (requested === null) return;
      setMode("memories");
      setStack([]);
      setCreating(false);
      setSearchText(requested);
      commitQuery(requested);
    };
    apply();
    return subscribeMemorySearch(apply);
  }, [workspaceId, commitQuery]);

  // A different committed query, or a different workspace, starts a new exploration: the old selection and detail clear.
  // Menu opens and closes, view switches, and layout choices leave this alone.
  useEffect(() => {
    setStack([]);
    setAnchorId(null);
  }, [query, workspaceId]);

  // The disclosures belong to the graph view. Leaving the graph, or leaving Memories, closes whichever one is open.
  const graphShown = mode === "memories" && resultView === "graph";
  useEffect(() => {
    if (!graphShown) setOpenMenu(null);
  }, [graphShown]);

  // A new workspace, search, or page is a new graph: expansions and selection from the old one are dropped.
  const generation = [context.workspaceId, directory, query, offset].join("\u001f");
  useEffect(() => {
    setGraph((current) => (current.generation === generation ? current : { ...EMPTY_GRAPH, generation }));
  }, [generation]);
  const scopedGraph: GraphState = graph.generation === generation ? graph : EMPTY_GRAPH;

  // Runs after the commit that unmounted the focused control. A node choice goes to the inspector, or to the Nodes trigger
  // when nothing in the inspector can take focus. A Layout choice returns to the Layout trigger.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === "layout") {
      focusControl(layoutControl);
    } else if (!focusControl(inspectorControl)) {
      focusControl(nodesControl);
    }
  });

  const expansionList = useMemo(() => Object.values(scopedGraph.expansions), [scopedGraph.expansions]);
  const loadedRecords = useMemo(() => mergeRecords(pageRecords, expansionList), [pageRecords, expansionList]);
  // The builder is pure. A throw is caught and shown inside the graph area, with the list still one tap away.
  const built = useMemo<{ model: MemoryGraphData | null; error: string | null }>(() => {
    try {
      return { model: buildMemoryGraph(loadedRecords), error: null };
    } catch (error) {
      return { model: null, error: errorMessage(error) };
    }
  }, [loadedRecords]);
  const model = built.model;
  // Required memories get the same badge in the Nodes picker as in the list.
  const requiredIds = useMemo(
    () => new Set(loadedRecords.filter((record) => record.required).map((record) => record.id)),
    [loadedRecords],
  );

  const topics = catalog.data?.filing ?? [];
  const resolvedFilingId = draft.filingId ?? (topics.length === 1 ? topics[0].id : null);

  // The Back control names the pane it returns to. Results is always one control away.
  const top: Pane | undefined = stack[stack.length - 1];
  const below: Pane | undefined = stack.length > 1 ? stack[stack.length - 2] : undefined;
  const backLabel = below ? (below.kind === "explore" ? "Back to exploration" : "Back to memory") : null;

  function openMemory(id: string) {
    setCreating(false);
    setAnchorId(id);
    setStack([{ kind: "memory", id }]);
  }

  function openPane(pane: Pane) {
    setCreating(false);
    setStack((current) => [...current, pane]);
  }

  function popPane() {
    setStack((current) => current.slice(0, -1));
  }

  // Channel and page changes replace the explore pane in place, so Back still returns to what started it.
  function replaceTop(pane: ExplorePane) {
    setStack((current) => [...current.slice(0, -1), pane]);
  }

  // Results: the list or graph shows again. The query, page, and anchor highlight stay as they were. A memory selected on
  // the graph closes with its detail, so the canvas and the inspector agree. A selected context node stays.
  function closePane() {
    setCreating(false);
    setStack([]);
    setGraph((current) => {
      const node = model?.nodes.find((candidate) => candidate.id === current.selectedId);
      return node && isMemoryNode(node) ? { ...current, selectedId: null } : current;
    });
  }

  // One selection destination for every node kind. A memory opens the memory detail; a context node opens the inspector.
  function selectNode(id: string | null) {
    if (id === null) {
      setGraph((current) => ({ ...current, selectedId: null }));
      return;
    }
    const node = model?.nodes.find((candidate) => candidate.id === id);
    if (node && isMemoryNode(node)) {
      setGraph((current) => ({ ...current, selectedId: id }));
      openMemory(id);
      return;
    }
    setCreating(false);
    setStack([]);
    setAnchorId(null);
    setGraph((current) => ({ ...current, selectedId: id }));
  }

  // An explicit Expand or Load more on one context node. Selection never reaches this. Rows already loaded are kept on
  // loading and on failure, and a response for an older generation is dropped.
  async function expandNode(node: MemoryGraphNode) {
    const relation = relationFor(node);
    const key = `${relation}:${node.id}`;
    const started = generation;
    const previous = scopedGraph.expansions[key];
    const retained = previous?.items ?? [];
    const offsetLoaded = retained.length;
    const put = (entry: GraphExpansion) =>
      setGraph((current) =>
        current.generation !== started ? current : { ...current, expansions: { ...current.expansions, [key]: entry } },
      );
    put({ relation, status: "loading", items: retained, total: previous?.total ?? 0, error: null });
    try {
      const result = await withDeadline(
        queryClient.fetchQuery({
          queryKey: [MEMORY_KEY, host.id, "graph", relation, node.id, context.workspaceId, context.cwd, offsetLoaded],
          queryFn: () => explore({ id: node.id, relation, context, offset: offsetLoaded, limit: EXPANSION_LIMIT }),
          staleTime: 30_000,
        }),
        EXPANSION_DEADLINE_MS,
      );
      const seen = new Set(retained.map((record) => record.id));
      const appended = result.items.map((item) => item.memory).filter((record) => !seen.has(record.id));
      put({ relation, status: "ready", items: [...retained, ...appended], total: result.total, error: null });
    } catch (error) {
      put({ relation, status: "error", items: retained, total: previous?.total ?? 0, error: errorMessage(error) });
    }
  }

  // A withdrawn memory is no longer current. Drop it from the graph: clear its selection, and drop any expansion that listed
  // it, so the next expand reads the store again. The query, the page, and the open detail stay as they were.
  function clearRetracted(id: string) {
    setGraph((current) => ({
      ...current,
      selectedId: current.selectedId === id ? null : current.selectedId,
      expansions: Object.fromEntries(
        Object.entries(current.expansions).filter(([, entry]) => !entry.items.some((item) => item.id === id)),
      ),
    }));
  }

  // A Layout choice from either surface. The announcement and the return of focus go with it.
  function chooseLayout(split: boolean) {
    setSplitGraph(split);
    setLayoutNote(`Layout ${split ? "Split" : "Auto"} selected.`);
    pendingFocus.current = "layout";
    setOpenMenu(null);
  }

  function startCreate() {
    // Resetting the mutation mid-flight would re-enable Save while the first request is still pending.
    if (save.isPending) return;
    setAnchorId(null);
    setStack([]);
    setSaved(null);
    setProblem(null);
    save.reset();
    setCreating(true);
  }

  function clearSearch() {
    setSearchText("");
    commitQuery("");
  }

  // A read-only search for the title, used after a failed save. It does not claim the save succeeded.
  function searchForTitle() {
    const title = draft.title.trim();
    setCreating(false);
    setMode("memories");
    setStack([]);
    setSearchText(title);
    commitQuery(title);
  }

  function submit() {
    if (save.isPending) return;
    const issue = operatorReady
      ? draftProblem(draft, resolvedFilingId, { loaded: catalog.isSuccess, count: topics.length })
      : "Set the operator name and identifier in Memory setup before saving.";
    setProblem(issue);
    if (issue) return;
    const payload: MemoryDraft = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      purpose: draft.purpose,
      required: draft.required,
      sourceRef: draft.sourceRef.trim(),
      scope: draft.scope,
      filingId: draft.purpose === "Operational" ? (resolvedFilingId ?? undefined) : undefined,
    };
    save.mutate(payload, {
      onSuccess: (record) => {
        setSaved(record);
        setDraft(EMPTY_DRAFT);
      },
    });
  }

  if (!online) {
    return (
      <View style={styles.root}>
        <StateBlock
          styles={styles}
          title={hostState === "connecting" ? `Connecting to ${host.label}…` : `${host.label} is offline`}
          body="Memory is unavailable until Paseo reconnects to this host. Your draft stays here while this panel is open."
        />
      </View>
    );
  }

  if (workspace === null) {
    return (
      <View style={styles.root}>
        <StateBlock styles={styles} title="Loading this workspace…" />
      </View>
    );
  }

  const health = status.data;
  if (status.isError) {
    return (
      <View style={styles.root}>
        <StateBlock styles={styles} title="Could not check memory" body={errorMessage(status.error)}>
          <Action styles={styles} tone="primary" label="Open memory settings" onPress={onOpenSetup} />
          <Action styles={styles} label="Try again" onPress={() => void status.refetch()} />
        </StateBlock>
      </View>
    );
  }

  if (!health) {
    return (
      <View style={styles.root}>
        <StateBlock styles={styles} title="Checking memory…" />
      </View>
    );
  }

  if (health.state !== "ready") {
    const setup = health.state === "setup";
    return (
      <View style={styles.root}>
        <StateBlock
          styles={styles}
          title={setup ? "Connect a memory store" : "Memory store needs attention"}
          body={health.message}
        >
          <Action styles={styles} tone="primary" label="Open memory settings" onPress={onOpenSetup} />
          <Action styles={styles} label="Check setup" onPress={() => void status.refetch()} />
        </StateBlock>
        <Text style={styles.muted}>
          Memory is stored on this host. Paths refer to this host's files, even when you use Paseo from a phone.
        </Text>
      </View>
    );
  }

  const ui: PanelUi = {
    styles,
    theme,
    compact,
    hostId: host.id,
    context,
    directory,
    operatorId,
    operatorName,
    scroll: scrollMemory,
  };

  const selectedNode = model?.nodes.find((node) => node.id === scopedGraph.selectedId);
  const contextNode = graphShown && selectedNode && !isMemoryNode(selectedNode) ? selectedNode : undefined;
  const contextExpansion = contextNode
    ? scopedGraph.expansions[`${relationFor(contextNode)}:${contextNode.id}`]
    : undefined;
  const destinationVisible = creating || stack.length > 0 || contextNode !== undefined;

  // Layout follows the panel's measured width. The host's compact flag only stands in before the first measurement.
  const fitWidth = width ?? (compact ? 0 : LIST_SPLIT_MIN_WIDTH);
  const narrow = fitWidth < LIST_SPLIT_MIN_WIDTH;
  // Layout governs only the graph. Auto stacks the graph and its inspector below the graph width; explicit Split keeps
  // them side by side at every width. The list keeps its own width rule.
  const singlePane = graphShown ? !splitGraph && fitWidth < GRAPH_SPLIT_MIN_WIDTH : narrow;
  const headerMerged = fitWidth >= LIST_SPLIT_MIN_WIDTH;
  // While a single-pane inspector covers the graph, Layout lives in that inspector's top row, with the same state.
  const layoutInInspector = singlePane && graphShown && destinationVisible;
  const layoutTrigger = layoutInInspector ? (
    <LayoutTrigger
      ui={ui}
      splitGraph={splitGraph}
      expanded={openMenu === "layout"}
      focusRef={layoutControl}
      onPress={() => setOpenMenu((current) => (current === "layout" ? null : "layout"))}
    />
  ) : undefined;
  const layoutChoices =
    layoutInInspector && openMenu === "layout" ? (
      <LayoutChoices ui={ui} splitGraph={splitGraph} onChoose={chooseLayout} />
    ) : undefined;
  // The Nodes picker's list is capped at 200px, or 40% of the panel height when that is shorter.
  const pickerHeight = bodyHeight === null ? 200 : Math.min(200, Math.round(bodyHeight * 0.4));
  const resultsLabel = graphShown ? "Back to graph" : "Back to results";

  const pageFrom = offset + 1;
  const pageTo = offset + pageRecords.length;
  const pageTotal = page.data?.total ?? 0;
  let countText = `Results ${pageFrom}–${pageTo} of ${pageTotal}`;
  if (page.isError) countText = "Results unavailable";
  else if (!page.data) countText = "Loading results…";
  else if (pageTotal === 0) countText = "No results";
  const captionText =
    graphShown && model && pageTotal > 0 ? `${countText} | Graph ${model.nodes.length} nodes` : countText;

  // The shared toolbar, any open disclosure, and the caption. It spans the full width above the split, so no pane can
  // paint over it.
  const toolbarRegion =
    mode === "memories" ? (
      <View>
        <MemoryToolbar
          ui={ui}
          searchText={searchText}
          onSearchText={setSearchText}
          onSubmitSearch={() => commitQuery(searchText.trim())}
          view={resultView}
          onView={setResultView}
          graphActive={graphShown}
          nodeCount={model?.nodes.length ?? 0}
          openMenu={openMenu}
          onToggleMenu={(menu) => setOpenMenu((current) => (current === menu ? null : menu))}
          splitGraph={splitGraph}
          showLayout={!layoutInInspector}
          nodesFocusRef={nodesControl}
          layoutFocusRef={layoutControl}
        />
  {openMenu === "nodes" && model ? (
          <NodePicker
            ui={ui}
            nodes={model.nodes}
            selectedId={scopedGraph.selectedId}
            requiredIds={requiredIds}
            listHeight={pickerHeight}
            onPick={(id) => {
              setOpenMenu(null);
              pendingFocus.current = "inspector";
              selectNode(id);
            }}
          />
        ) : null}
        {openMenu === "layout" && !layoutInInspector ? (
          <LayoutChoices ui={ui} splitGraph={splitGraph} onChoose={chooseLayout} />
        ) : null}
        <View style={styles.row}>
          <Text style={styles.muted}>{captionText}</Text>
          {graphShown ? (
            // The Layout trigger shows the choice. This text only reaches assistive technology.
            <Text accessibilityLiveRegion="polite" style={styles.visuallyHidden}>
              {layoutNote}
            </Text>
          ) : null}
        </View>
      </View>
    ) : null;

  // The list or the pinned graph. Each pane clips its own content, so nothing paints over the toolbar or the inspector.
  const contentRegion =
    mode === "memories" ? (
      <View style={styles.fill}>
        {resultView === "list" ? (
          <MemoryBrowse
            ui={ui}
            query={query}
            offset={offset}
            selectedId={anchorId}
            page={page}
            required={requiredCount}
            onOffset={setOffset}
            onOpen={openMemory}
            onNew={startCreate}
            onShowInstructions={() => setMode("instructions")}
            onClearSearch={clearSearch}
          />
        ) : (
          <MemoryGraph
            ui={ui}
            model={model}
            modelError={built.error}
            selectedId={scopedGraph.selectedId}
            onSelect={selectNode}
            pageStatus={page.data === undefined && !page.isError ? "loading" : page.isError ? "error" : "ready"}
            pageError={page.isError ? errorMessage(page.error) : null}
            onRetryPage={() => void page.refetch()}
            onUseList={() => setResultView("list")}
          />
        )}
      </View>
    ) : mode === "instructions" ? (
      <MemoryInstructions
        ui={ui}
        page={instructions}
        offset={instructionOffset}
        selectedId={anchorId}
        onOffset={setInstructionOffset}
        onOpen={openMemory}
        onNew={startCreate}
      />
    ) : (
      <MemoryHelp ui={ui} />
    );

  // The shared inspector destination: the create form, the memory detail, the explore pane, or the context inspector.
  let destination: ReactNode;
  if (creating) {
    destination = (
      <MemoryCreate
        ui={ui}
        narrow={singlePane || graphShown}
        draft={draft}
        catalog={catalog}
        resolvedFilingId={resolvedFilingId}
        saving={save.isPending}
        saveError={save.isError ? errorMessage(save.error) : null}
        saved={saved}
        problem={problem}
        onDraft={(patch) => {
          // The draft is frozen while a save is in flight, so the success path clears what was submitted.
          if (save.isPending) return;
          setDraft((current) => ({ ...current, ...patch }));
        }}
        onSubmit={submit}
        onCancel={closePane}
        onClearDraft={() => {
          if (save.isPending) return;
          setDraft(EMPTY_DRAFT);
          setProblem(null);
          save.reset();
        }}
        onViewSaved={() => {
          if (saved) openMemory(saved.id);
        }}
        onDismissSaved={() => setSaved(null)}
        onCheckTitle={searchForTitle}
        layoutTrigger={layoutTrigger}
        layoutChoices={layoutChoices}
      />
    );
  } else if (top?.kind === "memory") {
    destination = (
      <MemoryDetail
        key={`memory:${top.id}`}
        ui={ui}
        id={top.id}
        narrow={singlePane}
        onRetracted={clearRetracted}
        focusRef={inspectorControl}
        layoutTrigger={layoutTrigger}
        layoutChoices={layoutChoices}
        backLabel={backLabel}
        onBack={popPane}
        onResults={closePane}
        resultsLabel={resultsLabel}
        onOpen={openPane}
      />
    );
  } else if (top?.kind === "explore") {
    destination = (
      <MemoryExplore
        key={`explore:${top.active.id}:${top.active.relation}`}
        ui={ui}
        pane={top}
        focusRef={inspectorControl}
        layoutTrigger={layoutTrigger}
        layoutChoices={layoutChoices}
        backLabel={backLabel}
        onBack={popPane}
        onResults={closePane}
        resultsLabel={resultsLabel}
        onChange={replaceTop}
        onOpen={openPane}
      />
    );
  } else if (contextNode) {
    destination = (
      <ContextInspector
        ui={ui}
        node={contextNode}
        ancestry={relationFor(contextNode) === "filing" ? ancestryFor(contextNode.id, loadedRecords) : null}
        expansion={contextExpansion}
        onExpand={() => void expandNode(contextNode)}
        backLabel={singlePane ? "‹ Back to graph" : "Close"}
        onBack={() => selectNode(null)}
        focusRef={inspectorControl}
        layoutTrigger={layoutTrigger}
        layoutChoices={layoutChoices}
      />
    );
  } else {
    destination = (
      <StateBlock
        styles={styles}
        title={graphShown ? "Select a memory or context node" : "Select a memory"}
        body={graphShown ? "Its connections and history appear here." : "Its scope, source and history appear here."}
      />
    );
  }

  // The primary identity row, with the tabs and New memory merged onto it only when the width fits them.
  const identity = (
    <View style={{ gap: 4, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
      <Text style={styles.title}>Memory</Text>
      <Text style={styles.muted}>
        Operator: {operatorReady ? operatorName : settings.status === "loading" ? "loading…" : "not set"} · Scope:{" "}
        {directoryName(directory)}
      </Text>
      {operatorReady ? null : <Action styles={styles} tone="link" label="Set operator" onPress={onOpenSetup} />}
    </View>
  );
  const tabs = (
    <View style={[styles.segmented, headerMerged && { alignSelf: "flex-start", flexBasis: "auto" }]}>
      <Chip
        styles={styles}
        segment
        role="tab"
        label="Memories"
        selected={mode === "memories"}
        onPress={() => setMode("memories")}
      />
      <Chip
        styles={styles}
        segment
        role="tab"
        label="Instructions"
        selected={mode === "instructions"}
        onPress={() => setMode("instructions")}
      />
      <Chip styles={styles} segment role="tab" label="Help" selected={mode === "help"} onPress={() => setMode("help")} />
    </View>
  );
  const newButton = <Action styles={styles} tone="primary" label="New memory" onPress={startCreate} />;
  const header = destinationVisible && singlePane ? (
    <View style={styles.toolbarRow}>{identity}</View>
  ) : headerMerged ? (
    <View style={styles.toolbarRow}>
      {identity}
      <View style={styles.actionGroup}>
        {tabs}
        {newButton}
      </View>
    </View>
  ) : (
    <View style={styles.headerStack}>
      <View style={styles.headerRow}>
        {identity}
        {newButton}
      </View>
      {tabs}
    </View>
  );

  const rightVisible = destinationVisible || mode !== "help";
  // The toolbar leaves the stage while a single-pane inspector covers the results. Its Layout moves into that inspector.
  const toolbarVisible = mode === "memories" && (!singlePane || !destinationVisible);

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        setWidth(event.nativeEvent.layout.width);
        setBodyHeight(event.nativeEvent.layout.height);
      }}
    >
      {header}
      {toolbarVisible ? toolbarRegion : null}
      {singlePane ? (
        <View style={styles.fill}>
          {destinationVisible && !graphShown ? null : (
            // The graph stays mounted under a covering inspector, so its canvas, selection, and expansions survive Back.
            <View style={[styles.fill, destinationVisible && styles.hidden]}>{contentRegion}</View>
          )}
          {destinationVisible ? <View style={styles.fill}>{destination}</View> : null}
        </View>
      ) : (
        <View style={styles.split}>
          <View style={styles.listPane}>{contentRegion}</View>
          {rightVisible ? (
            <View style={graphShown ? styles.detailPaneBounded : styles.detailPane}>{destination}</View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// Client-side checks only. The backend stays the authority on scope, purpose and filing.
function draftProblem(
  draft: CreateDraft,
  filingId: string | null,
  topics: { loaded: boolean; count: number },
): string | null {
  if (draft.title.trim() === "") return "Add a short title.";
  if (draft.content.trim() === "") return "Add what should be remembered.";
  if (draft.required && draft.sourceRef.trim() === "") {
    return "Required instructions need a source. Add the document, ticket or link.";
  }
  if (draft.purpose === "Operational") {
    if (!topics.loaded) return "Topics are still loading. Try again in a moment.";
    if (topics.count === 0) return "Project knowledge needs a topic, and this memory store has none yet.";
    if (filingId === null) return "Choose the topic this project knowledge is filed under.";
  }
  return null;
}
