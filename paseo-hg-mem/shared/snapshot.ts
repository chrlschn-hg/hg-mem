import type { MemoryRecord } from './contracts';

// Shared by the human preview and the exact text staged in the composer.
export function attachmentText(m: MemoryRecord, scoped = false): string {
  return `[Memory snapshot; check current memory before acting]\nID: ${m.id}\n${m.title}\nPurpose: ${m.purpose}\nRequired: ${m.required}\nStatus: ${m.status}; temporal validity: ${m.validity}\nComposer applicability: ${scoped ? 'scoped lookup; check current directives' : 'not checked; selected from all scopes'}\nApplies to: ${m.scopes.map(s => `${s.name}${s.root ? ` (${s.root})` : ''}`).join(', ')}\nAsserted by: ${m.assertedBy} (${m.assertionKind})\nRecorded: ${m.createdAt}\nSource locator (not verified): ${m.sourceRef ?? 'None'}\n\n${m.content}`;
}
