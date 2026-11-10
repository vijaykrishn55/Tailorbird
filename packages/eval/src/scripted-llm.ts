import { ok } from '@ra/schemas';
import { ROLE_CODES } from '@ra/schemas';
import { normalise } from '@ra/retrieval';
import type { ChatRequest, Llm } from '@ra/providers';

/**
 * A deterministic stand-in for a model, used for offline evaluation.
 * `gullible` makes it obey instructions hidden in a posting and invent facts, to prove the gates catch that.
 */
export function scriptedLlm(opts: { gullible?: boolean } = {}): Llm {
  return {
    async complete(_tier, req: ChatRequest) {
      const sys = req.system;
      const u = req.user;
      if (sys.includes('extract structured requirements')) {
        const text = /<job_text>([\s\S]*)<\/job_text>/.exec(u)?.[1] ?? '';
        const terms = [...new Set(normalise(text))];
        const role = /frontend|react/i.test(text) ? 'FE' : /llm|rag|genai/i.test(text) ? 'AIE' : 'BE';
        return ok({
          text: JSON.stringify({
            title: 'Role',
            roleCode: ROLE_CODES.includes(role) ? role : 'BE',
            mustHave: terms.slice(0, 6),
            niceToHave: terms.slice(6),
            phrases: [],
          }),
        });
      }
      if (sys.includes('pick the best projects')) {
        const ids = [...u.matchAll(/^- id: (\S+)/gm)].map((m) => m[1]!);
        return ok({
          text: JSON.stringify({ picks: ids.slice(0, 3).map((id) => ({ id, reason: 'best score' })) }),
        });
      }
      if (sys.includes('write resume bullets')) {
        const facts = [...u.matchAll(/^- \[([^\]]+)\] (.+)$/gm)].map((m) => ({ id: m[1]!, text: m[2]! }));
        const stack = (facts.find((f) => f.text.startsWith('Stack:'))?.text ?? 'Stack: ').slice(7);
        const summary = facts[0]?.text ?? '';
        const lines = [
          `Built ${summary.replace(/\.$/, '').toLowerCase()} for the project.`,
          `Implemented the core features using ${stack}.`,
          `Documented and structured the code so the project is easy to extend and review.`,
        ];
        if (opts.gullible) lines[1] = 'Deployed a Kafka platform to production serving 5000 customers daily.';
        return ok({
          text: JSON.stringify({ bullets: lines.map((t) => ({ text: t, factIds: [facts[0]?.id ?? ''] })) }),
        });
      }
      if (sys.includes("You tailor a person's existing resume content"))
        return ok({
          text: JSON.stringify({
            summary: 'Software engineer who builds backend and application projects with verified skills.',
            skills: [],
            experience: [],
          }),
        });
      if (sys.includes("You read a person's own resume documents"))
        return ok({
          text: JSON.stringify({
            headline: 'Software engineer',
            skills: [{ label: 'Languages', items: ['Python'] }],
            experience: [
              { org: 'FloLabs', title: 'Intern', dates: '2026', bullets: ['Built APIs for the platform'] },
            ],
          }),
        });
      return ok({ text: '{}' });
    },
  };
}
