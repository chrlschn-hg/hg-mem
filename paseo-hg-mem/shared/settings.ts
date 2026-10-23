import { defineSettings } from '@getpaseo/plugin';
import { z } from 'zod';

export const MemorySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  agentIntegrationEnabled: z.boolean().default(true),
  databasePath: z.string().default(''),
  sqlitePath: z.string().default(''),
  extensionPath: z.string().default(''),
  operatorId: z.string().default(''),
  operatorName: z.string().default(''),
  skillsDirectory: z.string().default(''),
  projectBindings: z.record(z.string(), z.array(z.string())).default({}),
});

export type MemorySettings = z.infer<typeof MemorySettingsSchema>;
export const memorySettings = defineSettings({
  id: 'memory', scope: 'host', version: 1, schema: MemorySettingsSchema,
});
