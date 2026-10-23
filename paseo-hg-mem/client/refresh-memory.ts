import type { ExplorePage, MemoryRecord } from '../shared/contracts';
import type { GraphExpansion } from './types';
import { EXPANSION_LIMIT } from './graph-helpers';

// Refresh only the coverage the reader already loaded, not an unbounded neighborhood.
// Fetch from offset zero because additions/removals may have shifted page boundaries.
export async function refreshLoadedExpansion(
  previous: GraphExpansion,
  fetchPage: (offset: number, limit: number) => Promise<ExplorePage>,
): Promise<GraphExpansion> {
  const items: MemoryRecord[] = [];
  const seen = new Set<string>();
  let total = previous.total;
  const coverage = Math.max(EXPANSION_LIMIT, previous.items.length);
  for (let offset = 0; offset < coverage; offset += EXPANSION_LIMIT) {
    const page = await fetchPage(offset, Math.min(EXPANSION_LIMIT, coverage - offset));
    total = page.total;
    for (const { memory } of page.items) {
      if (!seen.has(memory.id)) { seen.add(memory.id); items.push(memory); }
    }
    if (offset + EXPANSION_LIMIT >= total || page.items.length === 0) break;
  }
  return { relation: previous.relation, status: 'ready', items, total, error: null };
}
