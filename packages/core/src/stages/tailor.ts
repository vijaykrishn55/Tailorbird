import { z } from 'zod';
import { askJson } from '@ra/providers';
import { canonical, canonicalSet, normalise } from '@ra/retrieval';
import { latexProblem, lengthProblem, numbersMissingFrom } from '@ra/verify';
import type { DraftProject, JobProfile, Profile, ResumeDraft } from '@ra/schemas';
import type { Deps } from '../ports';
import { makeSupportCheck } from '../docs';

const Reply = z.object({
  summary: z.string().max(700).default(''),
  skills: z
    .array(z.object({ label: z.string().max(40), items: z.array(z.string().max(60)).max(14) }))
    .max(7)
    .default([]),
  experience: z
    .array(z.object({ index: z.number().int().min(0), bullets: z.array(z.string().max(500)).max(4) }))
    .default([]),
});

const SYSTEM = `You tailor a person's existing resume content for one job. You may reorder, shorten and re-word, and mirror the job's keywords only where the person's own material supports them.
Never add a technology, number, employer, achievement or claim that is not in the material. If the material does not support a job keyword, leave it out.
Output JSON only: {"summary": "...", "skills": [{"label": "...", "items": ["..."]}], "experience": [{"index": 0, "bullets": ["..."]}]}.
- summary: 2 to 3 sentences, at most 55 words, written for this job, using only the material.
- skills: 4 to 8 labelled groups (for example Programming, Backend and APIs, Databases, AI/ML, Cloud and DevOps, Testing, Tools). Applicant tracking systems match keywords, so keep EVERY skill listed in the material unless it is clearly unrelated to this job, and put the job's required and preferred skills first in each group. Use only skills listed in the material. Up to 14 items per group.
- experience: for each experience entry, 2 to 3 bullets, 12 to 30 words each, starting with a past-tense verb, using only that entry's own facts. If an entry has no bullets in the material, return an empty list for it.`;

export interface Tailored {
  summary: string;
  skills: { label: string; items: string[] }[];
  experience: NonNullable<ResumeDraft['experience']>;
  notes: string[];
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * One model call for the summary, skills and experience wording, then every item is checked in code against the person's
 * own documents. Anything that fails is replaced by the original text, so nothing is invented.
 */
export async function tailorResume(
  deps: Deps,
  job: JobProfile,
  profile: Profile,
  corpus: string,
  projects: DraftProject[],
  /** Technologies verified in any of the person's repositories. They count as evidence for skills the job asks for. */
  evidence: string[] = [],
): Promise<Tailored> {
  const notes: string[] = [];
  const projectStacks = [...new Set(projects.flatMap((p) => p.stack))];
  const wantedJob = canonicalSet([...job.mustHave, ...job.niceToHave]);
  const evidenceHits = [...new Set(evidence)].filter((t) => wantedJob.has(canonical(t)));
  const allowedSkills = [
    ...new Set([...profile.skills.flatMap((g) => g.items), ...projectStacks, ...evidenceHits]),
  ];
  const skillOk = makeSupportCheck(`${corpus}\n${projectStacks.join(' ')}\n${evidenceHits.join(' ')}`);
  const allowedTerms = canonicalSet([...allowedSkills, ...normalise(corpus)]);
  const material = [
    `Headline: ${profile.headline || '(none)'}`,
    `Current summary: ${profile.summary || '(none)'}`,
    `Skills in the material: ${allowedSkills.join(', ') || '(none)'}`,
    `Education: ${profile.education.map((e) => `${e.degree}, ${e.school} ${e.detail}`).join(' | ') || '(none)'}`,
    'Experience:',
    ...profile.experience.map(
      (e, i) =>
        `[${i}] ${e.title} at ${e.org} (${e.dates})\n${e.bullets.map((b) => `  - ${b}`).join('\n') || '  (no bullets)'}`,
    ),
    `Projects chosen: ${projects.map((p) => p.name).join(', ')}`,
  ].join('\n');
  const jobText = `Role: ${job.title || job.roleCode}\nRequired: ${job.mustHave.join(', ') || '(none)'}\nPreferred: ${job.niceToHave.join(', ') || '(none)'}`;

  const check = (r: z.infer<typeof Reply>): string[] => {
    const problems: string[] = [];
    const s = r.summary.trim();
    if (s) {
      const bad = normalise(s).filter((t) => !allowedTerms.has(t));
      if (bad.length) problems.push(`summary mentions ${bad.join(', ')}, which is not in the material`);
      const nums = numbersMissingFrom(
        s,
        `${corpus} ${projects.flatMap((p) => p.bullets.map((b) => b.text)).join(' ')}`,
      );
      if (nums.length)
        problems.push(`summary uses the number ${nums.join(', ')}, which is not in the material`);
      if (words(s) > 70) problems.push('summary is too long');
      const lp = latexProblem(s);
      if (lp) problems.push(`summary ${lp}`);
    }
    for (const e of r.experience) {
      const src = profile.experience[e.index];
      if (!src) continue;
      const own = `${src.org} ${src.title} ${src.bullets.join(' ')}`;
      e.bullets.forEach((b, i) => {
        const nums = numbersMissingFrom(b, own);
        if (nums.length)
          problems.push(
            `experience [${e.index}] bullet ${i + 1} uses the number ${nums.join(', ')}, which is not in that entry`,
          );
        const bad = normalise(b).filter((t) => !allowedTerms.has(t));
        if (bad.length)
          problems.push(
            `experience [${e.index}] bullet ${i + 1} mentions ${bad.join(', ')}, which is not in the material`,
          );
        const len = lengthProblem(b, 8, 36);
        if (len) problems.push(`experience [${e.index}] bullet ${i + 1} ${len}`);
        const lp = latexProblem(b);
        if (lp) problems.push(`experience [${e.index}] bullet ${i + 1} ${lp}`);
      });
    }
    return problems;
  };

  let prompt = `${jobText}\n\nMaterial:\n${material}`;
  let reply: z.infer<typeof Reply> | undefined;
  let problems: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await askJson(deps.llm, Reply, SYSTEM, prompt, {
      tier: 'strong',
      signal: deps.signal,
      maxTokens: 4000,
    });
    if (!res.ok) {
      if (res.error.code === 'cancelled' || res.error.code === 'provider_auth')
        throw new Error(res.error.code);
      notes.push(`Tailoring step failed: ${res.error.message}`);
      break;
    }
    reply = res.value;
    problems = check(reply);
    if (problems.length === 0) break;
    prompt = `${jobText}\n\nMaterial:\n${material}\n\nYour previous answer was rejected by automatic checks:\n${problems.map((p) => `- ${p}`).join('\n')}\nReturn the whole JSON again, fixing exactly these problems.`;
  }

  // Build the result from what passed; fall back to the person's own wording for anything that did not.
  const out: Tailored = { summary: '', skills: [], experience: [], notes };
  const r = reply;
  const summaryBad = problems.some((p) => p.startsWith('summary'));
  out.summary = r && r.summary.trim() && !summaryBad ? r.summary.trim() : profile.summary;
  if (summaryBad) notes.push('The new summary could not be verified, so your original summary was used.');
  const skillGroups = (r?.skills ?? [])
    .map((g) => ({ label: g.label, items: [...new Set(g.items.filter((i) => skillOk(i)))] }))
    .filter((g) => g.items.length > 0);
  out.skills = completeSkills(skillGroups.length ? skillGroups : profile.skills, profile, allowedSkills, job);
  out.experience = profile.experience.map((e, i) => {
    const t = r?.experience.find((x) => x.index === i);
    const bad = problems.some((p) => p.startsWith(`experience [${i}]`));
    const bullets = t && t.bullets.length > 0 && !bad ? t.bullets : e.bullets;
    return { ...e, bullets: bullets.slice(0, 3) };
  });
  if (problems.some((p) => p.startsWith('experience')))
    notes.push('Some experience bullets could not be verified, so your original wording was kept.');
  return out;
}

const CATEGORIES: [RegExp, RegExp][] = [
  [
    /language|programming/i,
    /^(python|javascript|typescript|java|sql|bash|c\+\+|c#|go|rust|php|ruby|kotlin|swift|powershell)$/i,
  ],
  [
    /database|data store|storage/i,
    /(sql|mongo|redis|sqlite|postgres|mysql|firestore|dynamo|elastic|chroma|qdrant|pinecone|weaviate|faiss|vector)/i,
  ],
  [
    /ai|ml|machine|llm|data science/i,
    /(llm|rag|nlp|pytorch|tensorflow|scikit|numpy|pandas|transformers|hugging|langchain|langgraph|openai|groq|anthropic|prompt|embedding|vllm|lora|peft|mcp)/i,
  ],
  [
    /cloud|devops|infra|platform/i,
    /(docker|kubernetes|aws|azure|gcp|ci\/cd|github actions|terraform|linux|nginx|prometheus|grafana|helm)/i,
  ],
  [/backend|api|framework|web/i, /(fastapi|flask|django|node|express|rest|graphql|spring|uvicorn|pydantic)/i],
  [/front|ui/i, /(react|vue|next|tailwind|redux|vite|html|css|angular)/i],
  [/test|quality/i, /(pytest|jest|unit test|selenium|playwright)/i],
  [/tool/i, /(git|github|postman|jira|vite|webpack)/i],
];

/**
 * Applicant tracking systems match keywords, so the skills section keeps everything the person lists and also adds every
 * skill the job asks for that their documents or repositories show. Skills they have no evidence for are never added.
 */
function completeSkills(
  groups: { label: string; items: string[] }[],
  profile: Profile,
  pool: string[],
  job: JobProfile,
): { label: string; items: string[] }[] {
  const out = groups.map((g) => ({ label: g.label, items: [...g.items] }));
  const have = canonicalSet(out.flatMap((g) => g.items));
  const wanted = canonicalSet([...job.mustHave, ...job.niceToHave]);
  const missing = [
    ...profile.skills.flatMap((g) => g.items),
    ...pool.filter((t) => wanted.has(canonical(t))),
  ].filter((t, i, a) => !have.has(canonical(t)) && a.findIndex((x) => canonical(x) === canonical(t)) === i);
  for (const t of missing) {
    const cat = CATEGORIES.find(([lab, re]) => re.test(t) && out.some((g) => lab.test(g.label)));
    const target = cat ? out.find((g) => cat[0].test(g.label)) : out.find((g) => /other|tool/i.test(g.label));
    if (target) target.items.push(t);
    else out.push({ label: 'Other', items: [t] });
    have.add(canonical(t));
  }
  // The job's own keywords lead each group, then the person's order.
  return out.map((g) => ({
    label: g.label,
    items: [
      ...g.items.filter((i) => wanted.has(canonical(i))),
      ...g.items.filter((i) => !wanted.has(canonical(i))),
    ].slice(0, 16),
  }));
}
