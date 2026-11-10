import { z } from 'zod';
import { ok, type Result } from '@ra/schemas';
import { askJson, type Llm } from '@ra/providers';

export type Preference = 'a' | 'b' | 'tie';

const Reply = z.object({ winner: z.enum(['first', 'second', 'tie']) });

const SYSTEM = `You compare two versions of one resume bullet for a job. Judge only clarity, relevance to the job terms and professional tone.
Do not reward length. Do not invent facts. Reply with JSON only: {"winner":"first"|"second"|"tie"}.`;

/**
 * Pairwise preference run in both orders. If the two runs disagree (a sign of position bias) the result is a tie.
 */
export async function judgePair(
  llm: Llm,
  jobTerms: string[],
  a: string,
  b: string,
  signal?: AbortSignal,
): Promise<Result<Preference>> {
  const ask = (first: string, second: string) =>
    askJson(
      llm,
      Reply,
      SYSTEM,
      `Job terms: ${jobTerms.join(', ') || '(none)'}\n\nFirst:\n${first}\n\nSecond:\n${second}`,
      { tier: 'fast', signal },
    );
  const r1 = await ask(a, b);
  if (!r1.ok) return r1;
  const r2 = await ask(b, a);
  if (!r2.ok) return r2;
  const p1: Preference = r1.value.winner === 'first' ? 'a' : r1.value.winner === 'second' ? 'b' : 'tie';
  const p2: Preference = r2.value.winner === 'first' ? 'b' : r2.value.winner === 'second' ? 'a' : 'tie';
  return ok(p1 === p2 ? p1 : 'tie');
}
