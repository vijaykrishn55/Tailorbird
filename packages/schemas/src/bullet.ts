import { z } from 'zod';

export const MetricStatus = z.enum(['measured', 'target', 'none']);
export type MetricStatus = z.infer<typeof MetricStatus>;

export const Bullet = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(600),
  factIds: z.array(z.string()).default([]),
  metricStatus: MetricStatus.default('none'),
  status: z.enum(['ok', 'failed']).default('ok'),
  failures: z.array(z.string()).default([]),
});
export type Bullet = z.infer<typeof Bullet>;
