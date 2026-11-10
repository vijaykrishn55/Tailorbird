import { z } from 'zod';

/** The user's own details. Contact details are added to the output locally and never sent to a provider. */
export const Profile = z.object({
  name: z.string().default(''),
  headline: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  summary: z.string().default(''),
  skills: z.array(z.object({ label: z.string(), items: z.array(z.string()) })).default([]),
  experience: z
    .array(
      z.object({
        org: z.string(),
        title: z.string(),
        dates: z.string().default(''),
        location: z.string().default(''),
        bullets: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        school: z.string(),
        degree: z.string(),
        dates: z.string().default(''),
        detail: z.string().default(''),
      }),
    )
    .default([]),
  certifications: z.array(z.string()).default([]),
});
export type Profile = z.infer<typeof Profile>;

export const emptyProfile = (): Profile => Profile.parse({});
