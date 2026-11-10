import { z } from 'zod';
import { Bullet } from './bullet';

export const DraftProject = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().default(''),
  year: z.string().default(''),
  stack: z.array(z.string()).default([]),
  bullets: z.array(Bullet),
});
export type DraftProject = z.infer<typeof DraftProject>;

export const DraftExperience = z.object({
  org: z.string(),
  title: z.string(),
  dates: z.string().default(''),
  location: z.string().default(''),
  bullets: z.array(z.string()).default([]),
});

export const Gap = z.object({
  term: z.string(),
  reason: z.enum(['no_evidence', 'supported_not_included']),
});
export type Gap = z.infer<typeof Gap>;

export const ResumeDraft = z.object({
  summary: z.string().default(''),
  skills: z.array(z.object({ label: z.string(), items: z.array(z.string()) })).default([]),
  projects: z.array(DraftProject),
  gaps: z.array(Gap).default([]),
  /** Tailored experience, certifications and the section order learned from the user's own resume. */
  experience: z.array(DraftExperience).optional(),
  certifications: z.array(z.string()).optional(),
  order: z.array(z.string()).optional(),
});
export type ResumeDraft = z.infer<typeof ResumeDraft>;
