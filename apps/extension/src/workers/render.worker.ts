/// <reference lib="webworker" />
import { renderResume } from '@ra/core';
import { err } from '@ra/schemas';
import { createTypstRenderer } from '../lib/typst-renderer';
import type { WorkerIn, WorkerOut } from './protocol';

// The Typst WebAssembly glue calls `new Function('return this')` to find the global object. Extension pages forbid
// string evaluation (no 'unsafe-eval'), so only two harmless patterns (global lookup, returning a literal, returning one of its own arguments, throwing a fixed error) are answered here and everything else is refused.
const GLOBAL_LOOKUP = /^\s*return\s+(this|globalThis|self)\s*;?\s*$/;
const LITERAL_PROBE = /^\s*return\s+(-?\d+(?:\.\d+)?|true|false|null|undefined)\s*;?\s*$/;
const RETURN_PARAM = /^\s*return\s+([A-Za-z_$][\w$]*)\s*;?\s*$/;
const THROW_MESSAGE = /^\s*throw\s+new\s+Error\(\s*(['"])([^'"]*)\1\s*\)\s*;?\s*$/;
const safeFunction = (body: string, params: string[] = []): ((...a: unknown[]) => unknown) => {
  const t = THROW_MESSAGE.exec(body);
  if (t) {
    const message = t[2]!;
    return () => {
      throw new Error(message);
    };
  }
  const p = RETURN_PARAM.exec(body);
  if (p && params.includes(p[1]!)) {
    const i = params.indexOf(p[1]!);
    return (...a: unknown[]) => a[i];
  }
  if (GLOBAL_LOOKUP.test(body)) return () => globalThis;
  const n = LITERAL_PROBE.exec(body);
  if (n) {
    const lit = n[1]!;
    const value =
      lit === 'true'
        ? true
        : lit === 'false'
          ? false
          : lit === 'null'
            ? null
            : lit === 'undefined'
              ? undefined
              : Number(lit);
    return () => value;
  }
  return refuse(body);
};
const refuse = (body: string): never => {
  throw new Error(`Dynamic code is not allowed: ${body.slice(0, 60)}`);
};
globalThis.Function = new Proxy(Function, {
  construct: (_t, args: unknown[]) =>
    safeFunction(
      String(args[args.length - 1]),
      args.slice(0, -1).flatMap((a) =>
        String(a)
          .split(',')
          .map((x) => x.trim()),
      ),
    ),
  apply: (_t, _this, args: unknown[]) =>
    safeFunction(
      String(args[args.length - 1]),
      args.slice(0, -1).flatMap((a) =>
        String(a)
          .split(',')
          .map((x) => x.trim()),
      ),
    ),
});

const renderer = createTypstRenderer();
const post = (m: WorkerOut, transfer: Transferable[] = []) =>
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if ('cmd' in msg) return;
  const c = msg.command;
  if (c.cmd !== 'render-pdf')
    return post({ id: msg.id, type: 'done', result: err('unsupported', 'Unknown command.') });
  const res = await renderResume(
    { llm: { complete: async () => err('unsupported', 'No model in the renderer.') }, renderer },
    c.profile,
    c.draft,
    c.variant,
  );
  post({ id: msg.id, type: 'done', result: res }, res.ok ? [res.value.pdf.buffer as ArrayBuffer] : []);
};
