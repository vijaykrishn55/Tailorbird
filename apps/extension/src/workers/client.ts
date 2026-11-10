import { err, type Result } from '@ra/schemas';
import PipelineWorker from './pipeline.worker?worker';
import RenderWorker from './render.worker?worker';
import type { PipelineCommand, RenderCommand, WorkerIn, WorkerOut } from './protocol';

type Ev = Extract<WorkerOut, { type: 'event' }>['event'];

/** One long-lived worker per kind. Calls return a Result and can be cancelled. */
class WorkerClient {
  private worker?: Worker;
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: (r: Result<unknown>) => void; onEvent?: (e: Ev) => void }
  >();
  constructor(private readonly make: () => Worker) {}

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = this.make();
    w.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const m = ev.data;
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.type === 'event') p.onEvent?.(m.event);
      else {
        this.pending.delete(m.id);
        p.resolve(m.result);
      }
    };
    w.onerror = () => {
      for (const p of this.pending.values())
        p.resolve(err('network', 'The background worker stopped unexpectedly.'));
      this.pending.clear();
      this.worker = undefined;
    };
    this.worker = w;
    return w;
  }

  call<T>(
    command: PipelineCommand | RenderCommand,
    onEvent?: (e: Ev) => void,
    signal?: AbortSignal,
  ): Promise<Result<T>> {
    const id = ++this.seq;
    const w = this.ensure();
    return new Promise((resolve) => {
      this.pending.set(id, { resolve: resolve as (r: Result<unknown>) => void, onEvent });
      signal?.addEventListener('abort', () => w.postMessage({ id, cmd: 'cancel' } satisfies WorkerIn), {
        once: true,
      });
      w.postMessage({ id, command } satisfies WorkerIn);
    });
  }
}

export const pipelineWorker = new WorkerClient(() => new PipelineWorker());
export const renderWorker = new WorkerClient(() => new RenderWorker());
