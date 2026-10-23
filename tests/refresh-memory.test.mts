import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshLoadedExpansion } from '../paseo-hg-mem/client/refresh-memory.ts';
import type { ExplorePage, MemoryRecord } from '../paseo-hg-mem/shared/contracts.ts';
import type { GraphExpansion } from '../paseo-hg-mem/client/types.ts';

const record = (id: string) => ({ id }) as MemoryRecord;
const previous = (count: number): GraphExpansion => ({
  relation: 'filing', status: 'ready', items: Array.from({ length: count }, (_, i) => record(`old:${i}`)), total: count, error: null,
});
const page = (ids: string[], total: number) => ({ items: ids.map(id => ({ memory: record(id), via: '' })), total }) as ExplorePage;

test('refresh replaces stale expanded records and preserves loaded coverage without unbounded expansion', async () => {
  const calls: [number, number][] = [];
  const result = await refreshLoadedExpansion(previous(26), async (offset, limit) => {
    calls.push([offset, limit]);
    return page(Array.from({ length: limit }, (_, i) => `new:${offset + i}`), 100);
  });
  assert.deepEqual(calls, [[0, 20], [20, 6]]);
  assert.equal(result.total, 100);
  assert.equal(result.items.length, 26);
  assert.equal(result.items.some(item => item.id.startsWith('old:')), false);
});

test('refresh stops when the neighborhood shrinks and deduplicates moving page boundaries', async () => {
  let calls = 0;
  const result = await refreshLoadedExpansion(previous(40), async () => {
    calls++;
    return page(['remaining', 'remaining'], 2);
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.items.map(item => item.id), ['remaining']);
  assert.equal(result.total, 2);
});

test('a failed refresh does not mutate retained expansion data', async () => {
  const retained = previous(26);
  const before = JSON.stringify(retained);
  await assert.rejects(refreshLoadedExpansion(retained, async offset => {
    if (offset > 0) throw new Error('offline');
    return page(Array.from({ length: 20 }, (_, i) => `new:${i}`), 26);
  }), /offline/);
  assert.equal(JSON.stringify(retained), before);
});
