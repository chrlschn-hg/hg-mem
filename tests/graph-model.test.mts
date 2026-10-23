import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMemoryGraph } from '../paseo-hg-mem/client/graph-model.ts';
import type { MemoryRecord } from '../paseo-hg-mem/shared/contracts.ts';

function memory(id: string, patch: Partial<MemoryRecord> = {}): MemoryRecord {
  return { id, title: id, content: 'Example', purpose: 'Operational', required: false,
    status: 'active', createdAt: '2026-10-23T10:00:00Z', updatedAt: '2026-10-23T10:00:00Z',
    assertedBy: 'operator:a', assertionKind: 'explicit', sourceRef: null, validFrom: null,
    validTo: null, validity: 'APPLIES', scopes: [{ id: 'scope:global', name: 'Global',
      kind: 'global', root: null, matched: true }], filing: null, subjectId: null,
    filingPath: [], subject: null, revisions: [], ...patch };
}

test('graph uses factual typed ancestry, subjects and new-to-old revisions; scope is metadata', () => {
  const graph = buildMemoryGraph([memory('m:new', {
    filingPath: [{ id: 'd', name: 'Domain', label: 'Domain' },
      { id: 'a', name: 'Area', label: 'Area' }, { id: 't', name: 'Topic', label: 'Topic' }],
    subject: { id: 'o', name: 'Subject', label: 'Operator' },
    revisions: [{ id: 'm:old', title: 'Earlier', status: 'retired', validity: 'INACTIVE',
      createdAt: '', validFrom: null, validTo: null, direction: 'predecessor', depth: 1, via: '' }],
  })]);
  assert.deepEqual(graph.edges.map(e => [e.source, e.label, e.target]), [
    ['a', 'CHILD_OF', 'd'], ['t', 'CHILD_OF', 'a'], ['m:new', 'FILED_UNDER', 't'],
    ['m:new', 'ABOUT', 'o'], ['m:new', 'SUPERSEDES', 'm:old'],
  ]);
  assert.equal(graph.nodes.some(n => n.id === 'scope:global'), false);
  assert.equal(graph.nodes.find(n => n.id === 'm:old')?.historical, true);
});

test('cap reserves result nodes first and never emits dangling edges', () => {
  const rows = ['m:a', 'm:b', 'm:c'].map(id => memory(id, {
    filingPath: [{ id: 'd', name: 'Domain', label: 'Domain' }],
  }));
  const graph = buildMemoryGraph(rows, 3);
  assert.deepEqual(graph.nodes.map(n => n.id), ['m:a', 'm:b', 'm:c']);
  assert.equal(graph.omitted, 1);
  assert.deepEqual(graph.edges, []);
});

test('shared nodes and edges are deduplicated; successor direction is preserved', () => {
  const newer = memory('m:new');
  const old = memory('m:old', { revisions: [{ id: 'm:new', title: 'New', status: 'active',
    validity: 'APPLIES', createdAt: '', validFrom: null, validTo: null,
    direction: 'successor', depth: 1, via: '' }] });
  const graph = buildMemoryGraph([newer, old, old]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.nodes.find(n => n.id === 'm:new')?.historical, undefined);
  assert.deepEqual(graph.edges.map(e => [e.source, e.target]), [['m:new', 'm:old']]);
});
