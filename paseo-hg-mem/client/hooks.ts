import { useHosts, useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  memoryBrowse,
  memoryCatalog,
  memoryDirectives,
  memoryExplore,
  memoryInitialize,
  memoryRead,
  memorySave,
  memoryStatus,
  memoryVerify,
  type ExploreRelation,
  type MemoryContext,
  type MemoryDraft,
} from "../shared/contracts";

export const MEMORY_KEY = "hg-mem";

export type MemoryCatalog = z.infer<typeof memoryCatalog.output>;

export type HostState = "online" | "connecting" | "offline";

export function useHostState(hostId: string): HostState {
  const hosts = useHosts();
  const status = hosts.find((host) => host.serverId === hostId)?.status;
  if (status === "online") return "online";
  if (status === "offline" || status === "error") return "offline";
  return "connecting";
}

export function useWorkspaceSummary(workspaceId: string) {
  return useWorkspace(workspaceId, (workspace) => ({
    name: workspace.name,
    directory: workspace.directory,
    projectDisplayName: workspace.projectDisplayName,
  }));
}

export function memoryContext(workspaceId: string, directory: string): MemoryContext {
  return { workspaceId, cwd: directory, scopeIds: [] };
}

export function useMemoryStatus(hostId: string, enabled: boolean) {
  const status = useRpc(memoryStatus);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "status"],
    queryFn: () => status({}),
    enabled,
    retry: 1,
  });
}

export function useMemoryBrowse(
  hostId: string,
  context: MemoryContext,
  query: string,
  offset: number,
  limit: number,
  enabled: boolean,
) {
  const browse = useRpc(memoryBrowse);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "browse", context.workspaceId, context.cwd, query, offset, limit],
    queryFn: () => browse({ context, query, offset, limit }),
    enabled,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMemoryDirectives(
  hostId: string,
  context: MemoryContext,
  offset: number,
  limit: number,
  enabled: boolean,
) {
  const directives = useRpc(memoryDirectives);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "directives", context.workspaceId, context.cwd, offset, limit],
    queryFn: () => directives({ context, offset, limit }),
    enabled,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}

export function useMemoryRecord(hostId: string, id: string) {
  const read = useRpc(memoryRead);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "read", id],
    queryFn: () => read({ id }),
    retry: 1,
  });
}

export function useMemoryCatalog(hostId: string, enabled: boolean) {
  const catalog = useRpc(memoryCatalog);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "catalog"],
    queryFn: () => catalog({}),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useSaveMemory(hostId: string, context: MemoryContext) {
  const save = useRpc(memorySave);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: MemoryDraft) => save({ draft, context }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMORY_KEY, hostId] }),
  });
}

export function useInitializeMemory(hostId: string) {
  const initialize = useRpc(memoryInitialize);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => initialize({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMORY_KEY, hostId] }),
  });
}

// Store and search integrity check, run on demand from setup. It does not edit memories.
export function useMemoryVerify() {
  const verify = useRpc(memoryVerify);
  return useMutation({
    mutationFn: () => verify({}),
  });
}

// One channel of a memory or context node. Current memories and replacement history come back separately.
export function useMemoryExplore(
  hostId: string,
  id: string,
  relation: ExploreRelation,
  context: MemoryContext,
  offset: number,
  limit: number,
) {
  const explore = useRpc(memoryExplore);
  return useQuery({
    queryKey: [MEMORY_KEY, hostId, "explore", id, relation, context.workspaceId, context.cwd, offset, limit],
    queryFn: () => explore({ id, relation, context, offset, limit }),
    retry: 1,
  });
}
