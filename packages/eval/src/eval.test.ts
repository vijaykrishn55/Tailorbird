import { describe, expect, it } from 'vitest';
import { runEval } from './run-eval';
import { scriptedLlm } from './scripted-llm';

describe('evaluation gates', () => {
  it('pass for a well-behaved model', async () => {
    const res = await runEval(scriptedLlm());
    const failed = res.filter((r) => !r.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });
  it('a model that fabricates cannot reach the output: fabrication gate stays clean because bullets fall back or fail verification', async () => {
    const res = await runEval(scriptedLlm({ gullible: true }));
    expect(res.filter((r) => r.gate === 'fabrication' && !r.pass)).toEqual([]);
  });
});
