import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '@ra/core';
import { emptyProfile } from '@ra/schemas';
import { evaluate, type GateResult, type GoldenJob } from './gates';
import { FIXTURE_META } from './fixtures';
import { scriptedLlm } from './scripted-llm';
import type { Llm } from '@ra/providers';

export async function runEval(llm: Llm): Promise<GateResult[]> {
  const jobs = JSON.parse(
    readFileSync(fileURLToPath(new URL('../golden/jobs.json', import.meta.url)), 'utf8'),
  ) as GoldenJob[];
  const all: GateResult[] = [];
  for (const job of jobs) {
    const r = await runPipeline({ llm }, { jobText: job.text, meta: FIXTURE_META, profile: emptyProfile() });
    if (!r.ok) {
      all.push({ job: job.id, gate: 'pipeline', pass: false, detail: r.error.message });
      continue;
    }
    all.push(...evaluate(job, r.value, FIXTURE_META));
  }
  return all;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = await runEval(scriptedLlm());
  const failed = res.filter((r) => !r.pass);
  for (const r of res) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.job}  ${r.gate}  ${r.detail}`);
  writeFileSync(fileURLToPath(new URL('../last-run.json', import.meta.url)), JSON.stringify(res, null, 2));
  console.log(`\n${res.length - failed.length}/${res.length} gates passed`);
  process.exit(failed.length ? 1 : 0);
}
