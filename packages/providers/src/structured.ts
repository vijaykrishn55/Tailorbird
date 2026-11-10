import type { z } from 'zod';
import { err, ok, type Result } from '@ra/schemas';
import type { Llm, Tier } from './types';

export interface AskJsonOptions {
  tier?: Tier;
  maxRepairs?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Extra semantic check after the schema passes. Return a message to send back, or undefined if fine. */
  refine?: (value: unknown) => string | undefined;
}

/** Pull the first JSON object out of a reply, tolerating code fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('No JSON object found in the reply.');
  }
}

/**
 * Ask for JSON, validate with Zod, and on failure send the exact error back (at most `maxRepairs` times).
 * The model's text is only ever parsed as data.
 */
export async function askJson<S extends z.ZodTypeAny>(
  llm: Llm,
  schema: S,
  system: string,
  user: string,
  opts: AskJsonOptions = {},
): Promise<Result<z.infer<S>>> {
  const tier = opts.tier ?? 'fast';
  const maxRepairs = opts.maxRepairs ?? 2;
  let prompt = user;
  let lastMessage = 'The reply did not match the expected format.';
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const res = await llm.complete(
      tier,
      { system, user: prompt, json: true, maxTokens: opts.maxTokens },
      opts.signal,
    );
    if (!res.ok) return res;
    let problem: string | undefined;
    try {
      const raw = extractJson(res.value.text);
      const parsed = schema.safeParse(raw);
      if (parsed.success) {
        const refined = opts.refine?.(parsed.data);
        if (!refined) return ok(parsed.data);
        problem = refined;
      } else {
        problem = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      }
    } catch (e) {
      problem = e instanceof Error ? e.message : 'Invalid JSON.';
    }
    lastMessage = problem;
    prompt = `${user}\n\nYour previous reply was rejected: ${problem}\nReply again with only the corrected JSON object.`;
  }
  return err('validation', 'The model reply could not be validated.', lastMessage);
}
