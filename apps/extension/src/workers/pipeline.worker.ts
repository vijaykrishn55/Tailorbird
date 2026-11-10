/// <reference lib="webworker" />
import {
  assembleOwnLatex,
  extractProfile,
  parseOwnProjects,
  restyleLatex,
  runPipeline,
  type Deps,
} from '@ra/core';
import { GitHubClient, indexRepos } from '@ra/indexer';
import { askJson } from '@ra/providers';
import { checkBullet } from '@ra/verify';
import { z } from 'zod';
import { err, ok, type Result } from '@ra/schemas';
import { buildLlm } from './build-llm';
import type { WorkerIn, WorkerOut } from './protocol';

const controllers = new Map<number, AbortController>();
const post = (m: WorkerOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
const gh = new GitHubClient((url, init) => fetch(url, { ...init, credentials: 'omit' }) as never);

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if ('cmd' in msg) {
    controllers.get(msg.id)?.abort();
    return;
  }
  const { id, command } = msg;
  const ctl = new AbortController();
  controllers.set(id, ctl);
  const emit: Deps['emit'] = (event) => post({ id, type: 'event', event });
  let result: Result<unknown>;
  try {
    switch (command.cmd) {
      case 'index-repos': {
        result = await indexRepos(gh, command.user, new Date().toISOString().slice(0, 10), {
          signal: ctl.signal,
          onProgress: (done, total, name) =>
            emit({
              type: 'progress',
              stage: 'analyse',
              message: name ? `Reading ${name}` : 'Done',
              done,
              total,
            }),
        });
        break;
      }
      case 'run': {
        const r = await runPipeline(
          { llm: buildLlm(command.config), emit, signal: ctl.signal },
          {
            jobText: command.jobText,
            meta: command.meta,
            profile: command.profile,
            corpus: command.corpus,
            order: command.order,
            own: parseOwnProjects(command.latex),
            count: command.count,
          },
        );
        // The trace object cannot cross the worker boundary; send its redacted export instead.
        result = r.ok ? ok({ ...r.value, trace: r.value.trace.export() }) : r;
        break;
      }
      case 'extract-profile':
        result = await extractProfile({ llm: buildLlm(command.config), signal: ctl.signal }, command.docs);
        break;
      case 'own-latex': {
        const t = assembleOwnLatex(command.latex, command.profile, command.draft, {
          smallerText: command.smallerText,
        });
        result = t ? ok(t) : err('unsupported', 'Not a macro-based layout.');
        break;
      }
      case 'restyle-latex':
        result = await restyleLatex(
          { llm: buildLlm(command.config), signal: ctl.signal },
          command.latex,
          command.profile,
          command.draft,
        );
        break;
      case 'rewrite-bullet': {
        const Reply = z.object({ text: z.string().min(1).max(600) });
        const llm = buildLlm(command.config);
        const entry = command.entry;
        const facts = [
          entry.summary,
          ...entry.metrics.map((m) => `${m.name}: ${m.value}`),
          ...entry.bullets.map((b) => b.text),
          `Stack: ${entry.stackVerified.join(', ')}`,
        ].join('\n- ');
        const res = await askJson(
          llm,
          Reply,
          'Rewrite one resume bullet. Use only the supplied facts, 8 to 34 words, plain text. Reply with JSON only: {"text":"..."}',
          `Facts:\n- ${facts}\nInstruction: ${command.instruction}`,
          {
            tier: 'strong',
            signal: ctl.signal,
            refine: (v) => {
              const f = checkBullet({ id: command.bulletId, text: (v as { text: string }).text }, entry);
              return f.length ? f.map((x) => x.message).join('; ') : undefined;
            },
          },
        );
        result = res;
        break;
      }
      default:
        result = err('unsupported', 'Unknown command.');
    }
  } catch (e) {
    result = ctl.signal.aborted
      ? err('cancelled', 'The run was cancelled.')
      : err('network', 'Something went wrong while running.', e instanceof Error ? e.message : String(e));
  }
  controllers.delete(id);
  post({ id, type: 'done', result });
};
