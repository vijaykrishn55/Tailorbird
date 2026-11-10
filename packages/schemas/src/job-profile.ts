import { z } from 'zod';

export const ROLE_CODES = [
  'AIE',
  'MLOPS',
  'BE',
  'FS',
  'SDE',
  'QA',
  'DS',
  'DEVOPS',
  'SEC',
  'FE',
  'SYS',
] as const;
export const RoleCode = z.enum(ROLE_CODES);
export type RoleCode = z.infer<typeof RoleCode>;

export const ROLE_LABELS: Record<RoleCode, string> = {
  AIE: 'AI / GenAI / LLM application engineer',
  MLOPS: 'LLMOps / ML systems / inference engineer',
  BE: 'Backend developer',
  FS: 'Full-stack developer',
  SDE: 'Software engineer (entry level)',
  QA: 'Automation / test / evaluation engineer',
  DS: 'Data scientist / ML engineer (junior)',
  DEVOPS: 'DevOps / platform / cloud (junior)',
  SEC: 'AI security / trust and safety',
  FE: 'Frontend developer',
  SYS: 'Systems / low-level (junior)',
};

export const JobProfile = z.object({
  title: z.string().max(200).default(''),
  company: z.string().max(200).optional(),
  roleCode: RoleCode,
  mustHave: z.array(z.string().min(1).max(80)).max(40),
  niceToHave: z.array(z.string().min(1).max(80)).max(40),
  phrases: z.array(z.string().min(1).max(120)).max(40),
});
export type JobProfile = z.infer<typeof JobProfile>;
