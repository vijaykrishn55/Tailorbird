import { z } from 'zod';

export const CONSENT_VERSION = 1;

export const ProviderConfig = z.object({
  name: z.string().default('Groq'),
  baseUrl: z.string().url().default('https://api.groq.com/openai/v1'),
  fastModel: z.string().default('openai/gpt-oss-20b'),
  strongModel: z.string().default('openai/gpt-oss-120b'),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const Settings = z.object({
  consentVersion: z.number().default(0),
  provider: ProviderConfig.default({}),
  engine: z.enum(['typst', 'busytex']).default('typst'),
  historyEnabled: z.boolean().default(true),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  limits: z
    .object({ requestsPerMinute: z.number().default(30), tokensPerMinute: z.number().default(6000) })
    .default({}),
});
export type Settings = z.infer<typeof Settings>;

export const defaultSettings = (): Settings => Settings.parse({});
