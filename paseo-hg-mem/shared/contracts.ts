import { defineRpc, defineAttachmentSource } from '@getpaseo/plugin';
import { z } from 'zod';
import { MemorySettingsSchema } from './settings';

export const PurposeSchema = z.enum(['Persona', 'Operational', 'CAPA']);
export const MemoryContextSchema = z.object({
  workspaceId: z.string().optional(),
  cwd: z.string().default('/'),
  scopeIds: z.array(z.string()).default([]),
});
export type MemoryContext = z.infer<typeof MemoryContextSchema>;

export const ScopeSchema = z.object({
  id: z.string(), name: z.string(), kind: z.string(), root: z.string().nullable(),
  matched: z.boolean().nullable().default(null),
});
export const GraphNodeSchema = z.object({ id: z.string(), name: z.string(), label: z.string() });
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export const RevisionRefSchema = z.object({
  id: z.string(), title: z.string(), status: z.enum(['active', 'retired', 'retracted']),
  validity: z.enum(['APPLIES', 'POSSIBLE', 'INACTIVE', 'RETRACTED']),
  createdAt: z.string(), validFrom: z.string().nullable(), validTo: z.string().nullable(),
  direction: z.enum(['predecessor', 'successor']), depth: z.number().int().min(1).max(3),
  via: z.string(),
});
export type RevisionRef = z.infer<typeof RevisionRefSchema>;
export const MemoryRecordSchema = z.object({
  id: z.string(), title: z.string(), content: z.string(), purpose: PurposeSchema,
  required: z.boolean(), status: z.enum(['active', 'retired', 'retracted']),
  createdAt: z.string(), updatedAt: z.string(),
  assertedBy: z.string(), assertionKind: z.string(),
  sourceRef: z.string().nullable(), validFrom: z.string().nullable(), validTo: z.string().nullable(),
  validity: z.enum(['APPLIES', 'POSSIBLE', 'INACTIVE', 'RETRACTED']),
  scopes: z.array(ScopeSchema),
  filing: z.object({ id: z.string(), name: z.string(), label: z.string() }).nullable(),
  subjectId: z.string().nullable(),
  filingPath: z.array(GraphNodeSchema).max(3).default([]),
  subject: GraphNodeSchema.nullable().default(null),
  revisions: z.array(RevisionRefSchema.extend({ depth: z.literal(1) })).max(2).default([]),
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const MemoryPageSchema = z.object({
  items: z.array(MemoryRecordSchema), total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(), limit: z.number().int().positive(),
  contextLabel: z.string(),
});
export type MemoryPage = z.infer<typeof MemoryPageSchema>;
const PageInput = z.object({
  context: MemoryContextSchema.default({ cwd: '/', scopeIds: [] }),
  query: z.string().default(''), offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(30),
});

export const HealthSchema = z.object({
  state: z.enum(['setup', 'ready', 'error']), message: z.string(),
  settings: MemorySettingsSchema,
  suggestedDatabasePath: z.string(), suggestedSqlitePath: z.string(), suggestedExtensionPath: z.string(),
  memoryCount: z.number().int().nonnegative().default(0),
  skillsInstalled: z.boolean().default(false),
});
export type MemoryHealth = z.infer<typeof HealthSchema>;
export const memoryStatus = defineRpc({ name: 'memory.status', input: z.object({}), output: HealthSchema });
export const memoryInitialize = defineRpc({
  name: 'memory.initialize', input: z.object({ context: MemoryContextSchema.optional() }), output: HealthSchema,
});
export const memoryBrowse = defineRpc({ name: 'memory.browse', input: PageInput, output: MemoryPageSchema });
export const memoryDirectives = defineRpc({
  name: 'memory.directives', input: PageInput.omit({ query: true }), output: MemoryPageSchema,
});
export const memoryRead = defineRpc({
  name: 'memory.read', input: z.object({ id: z.string().min(1) }), output: MemoryRecordSchema,
});
export const MemoryDraftSchema = z.object({
  title: z.string().trim().min(1).max(300), content: z.string().trim().min(1).max(20000),
  purpose: PurposeSchema, required: z.boolean().default(false),
  sourceRef: z.string().max(4000).default(''),
  scope: z.enum(['workspace', 'global']).default('workspace'),
  filingId: z.string().optional(),
});
export type MemoryDraft = z.infer<typeof MemoryDraftSchema>;
export const memorySave = defineRpc({
  name: 'memory.save', input: z.object({ draft: MemoryDraftSchema, context: MemoryContextSchema }),
  output: MemoryRecordSchema,
});
export const memoryRetire = defineRpc({
  name: 'memory.retire', input: z.object({ id: z.string().min(1) }), output: MemoryRecordSchema,
});
export const memoryVerify = defineRpc({
  name: 'memory.verify', input: z.object({}), output: z.object({ ok: z.boolean(), message: z.string() }),
});
export const memoryCatalog = defineRpc({
  name: 'memory.catalog', input: z.object({}), output: z.object({
    scopes: z.array(ScopeSchema),
    filing: z.array(z.object({ id: z.string(), name: z.string(), label: z.string() })),
  }),
});
// Legacy low-level walk. Prefer memory.explore for typed, paged current/history channels.
export const memoryNavigate = defineRpc({
  name: 'memory.navigate', input: z.object({ id: z.string(), context: MemoryContextSchema, depth: z.number().int().min(1).max(3).default(2) }),
  output: z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), label: z.string(), via: z.string(), depth: z.number() })) }),
});
export const ExploreRelationSchema = z.enum(['filing', 'subject', 'revisions']);
export type ExploreRelation = z.infer<typeof ExploreRelationSchema>;
export const ExplorePageSchema = z.object({
  seed: GraphNodeSchema, relation: ExploreRelationSchema,
  total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(), contextLabel: z.string(),
  // total/offset/limit describe history for revisions; items for filing/subject.
  items: z.array(z.object({ memory: MemoryRecordSchema, via: z.string() })),
  history: z.array(RevisionRefSchema),
}).superRefine((page, ctx) => {
  if (page.relation === 'revisions' ? page.items.length !== 0 : page.history.length !== 0) {
    ctx.addIssue({ code: 'custom', message: 'Current memories and revision history must be separate channels.' });
  }
});
export type ExplorePage = z.infer<typeof ExplorePageSchema>;
export const memoryExplore = defineRpc({
  name: 'memory.explore',
  input: z.object({ id: z.string().min(1), relation: ExploreRelationSchema,
    context: MemoryContextSchema, offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(30) }),
  output: ExplorePageSchema,
});
export const memoryAttachmentSearch = defineRpc({
  name: 'memory.attachments',
  input: z.object({ query: z.string().default(''), agentId: z.string().optional(), workspaceId: z.string().optional(), cwd: z.string().optional() }).passthrough(),
  output: z.object({ items: z.array(z.object({
    id: z.string(), identifier: z.string(), title: z.string(), subtitle: z.string().optional(),
    url: z.string().url(), text: z.string(), resourceType: z.string(),
  })) }),
});
export const memoryAttachmentSource = defineAttachmentSource({
  id: 'memories', title: 'Memory', icon: 'Brain', pickerTitle: 'Active memories · all scopes',
  searchPlaceholder: 'Search active memories in all scopes', search: memoryAttachmentSearch,
});
