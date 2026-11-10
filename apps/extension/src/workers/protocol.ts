import type { Docs, MetaFile, Profile, ProjectEntry, ResumeDraft, Result, Settings } from '@ra/schemas';
import type { RunEvent } from '@ra/core';

export interface WorkerConfig {
  settings: Settings;
  apiKey: string;
}

export type PipelineCommand =
  | { cmd: 'index-repos'; user: string }
  | {
      cmd: 'run';
      jobText: string;
      meta: MetaFile;
      profile: Profile;
      corpus: string;
      order: string[];
      latex: string;
      config: WorkerConfig;
      count?: number;
    }
  | { cmd: 'extract-profile'; docs: Docs; config: WorkerConfig }
  | { cmd: 'own-latex'; latex: string; profile: Profile; draft: ResumeDraft; smallerText: boolean }
  | { cmd: 'restyle-latex'; latex: string; profile: Profile; draft: ResumeDraft; config: WorkerConfig }
  | {
      cmd: 'rewrite-bullet';
      entry: ProjectEntry;
      bulletId: string;
      instruction: string;
      config: WorkerConfig;
    };

export type RenderCommand = { cmd: 'render-pdf'; profile: Profile; draft: ResumeDraft; variant?: string };

export type WorkerIn =
  { id: number; command: PipelineCommand | RenderCommand } | { id: number; cmd: 'cancel' };

export type WorkerOut =
  | {
      id: number;
      type: 'event';
      event: RunEvent | { type: 'progress'; stage: string; message: string; done?: number; total?: number };
    }
  | { id: number; type: 'done'; result: Result<unknown> };
