import { z } from 'zod';

export const Fact = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source: z.enum(['readme', 'deps', 'resume', 'linkedin', 'user']),
  kind: z.enum(['tech', 'metric', 'feature', 'claim']),
  evidence: z.array(z.string()).default([]),
});
export type Fact = z.infer<typeof Fact>;
