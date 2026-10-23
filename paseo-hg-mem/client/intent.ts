type Listener = () => void;

// Search text handed from the /memory command or Command Center to an open or soon-to-open panel.
// In-memory only: it is not persisted and is cleared once the panel takes it.
const pendingSearches = new Map<string, string>();
const listeners = new Set<Listener>();

export function requestMemorySearch(workspaceId: string, query: string): void {
  pendingSearches.set(workspaceId, query.trim());
  for (const listener of listeners) listener();
}

export function takeMemorySearch(workspaceId: string): string | null {
  const query = pendingSearches.get(workspaceId);
  if (query === undefined) return null;
  pendingSearches.delete(workspaceId);
  return query;
}

export function subscribeMemorySearch(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
