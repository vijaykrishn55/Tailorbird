import type { Renderer } from '@ra/latex';
import type { Llm } from '@ra/providers';

export type { Llm, Renderer };

export type Stage = 'sanitise' | 'analyse' | 'rank' | 'generate' | 'verify' | 'summary' | 'render';

export type RunEvent =
  | { type: 'progress'; stage: Stage; message: string; done?: number; total?: number }
  | { type: 'partial'; stage: Stage; data: unknown };

export interface Deps {
  llm: Llm;
  renderer?: Renderer;
  emit?: (e: RunEvent) => void;
  signal?: AbortSignal;
}
