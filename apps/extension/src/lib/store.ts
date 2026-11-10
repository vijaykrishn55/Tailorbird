import { create } from 'zustand';
import {
  CONSENT_VERSION,
  defaultSettings,
  emptyProfile,
  parseMetaFile,
  serializeMetaFile,
  emptyDocs,
  type AppError,
  type Docs,
  type MetaFile,
  type Profile,
  type ResumeDraft,
  type Settings,
} from '@ra/schemas';
import { idbAll, idbDelete, idbGet, idbSet } from './idb';
import {
  deleteAllData,
  hasConsent,
  loadApiKey,
  loadSettings,
  requestProviderAccess,
  saveApiKey,
  saveSettings,
} from './settings';
import { captureActiveTab } from './capture';
import { pipelineWorker, renderWorker } from '../workers/client';
import type { RunOutput } from '@ra/core';

export type View = 'job' | 'projects' | 'profile' | 'history' | 'settings';
export type Step = 'input' | 'ranking' | 'draft' | 'preview';
type RunResult = Omit<RunOutput, 'trace'> & { trace: string };

export interface HistoryItem {
  id: string;
  at: string;
  title: string;
  url: string;
  draft: ResumeDraft;
  picks: { id: string; reason: string }[];
}

interface State {
  ready: boolean;
  settings: Settings;
  hasKey: boolean;
  meta: MetaFile | null;
  profile: Profile;
  docs: Docs;
  corpus: string;
  order: string[];
  history: HistoryItem[];
  view: View;
  step: Step;
  job: { text: string; title: string; url: string };
  busy: { label: string; done?: number; total?: number; stage?: string } | null;
  error: AppError | null;
  notice: string | null;
  run: RunResult | null;
  draft: ResumeDraft | null;
  pdfUrl: string | null;
  texOwn: string | null;
  sources: { tex: string; typ: string; steps: string[]; pages: number } | null;
  abort: AbortController | null;
  /** What the Try again button repeats after a failure. */
  retry: 'run' | 'render' | null;
  /** True when bullets, stack lines or projects changed after the PDF was built. */
  dirty: boolean;
  tryAgain(): Promise<void>;

  init(): Promise<void>;
  setView(v: View): void;
  setStep(s: Step): void;
  acceptConsent(): Promise<void>;
  updateSettings(s: Settings, key?: string): Promise<boolean>;
  setJob(j: Partial<State['job']>): void;
  captureJob(): Promise<void>;
  indexGithub(user: string): Promise<void>;
  importMeta(json: string): void;
  exportMeta(): string | null;
  saveProfile(p: Profile): Promise<void>;
  saveDocs(d: Docs): Promise<void>;
  readDocs(d: Docs): Promise<void>;
  excludeProject(id: string, excluded: boolean): Promise<void>;
  setStack(pid: string, stack: string[]): void;
  buildOwnTex(): Promise<void>;
  startRun(): Promise<void>;
  cancel(): void;
  editBullet(projectId: string, bulletId: string, text: string): void;
  removeBullet(projectId: string, bulletId: string): void;
  rewriteBullet(projectId: string, bulletId: string, instruction: string): Promise<void>;
  render(): Promise<void>;
  openHistory(id: string): void;
  deleteHistory(id: string): Promise<void>;
  wipe(): Promise<void>;
  dismiss(): void;
}

const fail = (error: AppError) => ({ error, busy: null, abort: null });

export const useStore = create<State>((set, get) => ({
  ready: false,
  settings: defaultSettings(),
  hasKey: false,
  meta: null,
  profile: emptyProfile(),
  docs: emptyDocs(),
  corpus: '',
  order: [],
  history: [],
  texOwn: null,
  view: 'job',
  step: 'input',
  job: { text: '', title: '', url: '' },
  busy: null,
  error: null,
  notice: null,
  run: null,
  draft: null,
  pdfUrl: null,
  sources: null,
  abort: null,
  retry: null,
  dirty: false,
  async tryAgain() {
    const r = get().retry;
    set({ error: null });
    if (r === 'render') await get().render();
    else await get().startRun();
  },

  async init() {
    const [settings, key, meta, profile, docs, extra, history] = await Promise.all([
      loadSettings(),
      loadApiKey(),
      idbGet<MetaFile>('meta', 'main'),
      idbGet<Profile>('profile', 'main'),
      idbGet<Docs>('docs', 'main'),
      idbGet<{ corpus: string; order: string[] }>('docs', 'read'),
      idbAll<HistoryItem>('history'),
    ]);
    set({
      settings,
      hasKey: key.length > 0,
      meta: meta ?? null,
      profile: profile ?? emptyProfile(),
      docs: docs ?? emptyDocs(),
      corpus: extra?.corpus ?? '',
      order: extra?.order ?? [],
      history: history.sort((a, b) => b.at.localeCompare(a.at)),
      ready: true,
      view: !meta ? 'projects' : 'job',
    });
  },
  setView: (view) => set({ view, error: null, notice: null }),
  setStep: (step) => set({ step }),
  async acceptConsent() {
    const s = { ...get().settings, consentVersion: CONSENT_VERSION };
    await saveSettings(s);
    set({ settings: s });
  },
  async updateSettings(s, key) {
    if (key !== undefined) {
      await saveApiKey(key);
      set({ hasKey: key.trim().length > 0 });
    }
    const ok = await requestProviderAccess(s.provider.baseUrl);
    if (!ok) {
      set({
        error: {
          code: 'provider_bad_request',
          message:
            'The provider address was not allowed. Use an https address and accept the browser prompt.',
          retryable: false,
        },
      });
      return false;
    }
    await saveSettings(s);
    set({ settings: s, notice: 'Settings saved.', error: null });
    return true;
  },
  setJob: (j) => set((st) => ({ job: { ...st.job, ...j } })),
  async captureJob() {
    try {
      const c = await captureActiveTab();
      set({ job: { text: c.text, title: c.title, url: c.url }, error: null });
    } catch (e) {
      set({
        error: {
          code: 'capture',
          message: e instanceof Error ? e.message : 'Could not read the page.',
          retryable: false,
        },
      });
    }
  },
  async indexGithub(user) {
    const { settings } = get();
    if (!hasConsent(settings))
      return set(
        fail({ code: 'consent_required', message: 'Accept the privacy notice first.', retryable: false }),
      );
    const ctl = new AbortController();
    set({ busy: { label: 'Reading your repositories' }, error: null, abort: ctl });
    const r = await pipelineWorker.call<{
      meta: MetaFile;
      total: number;
      forks: number;
      profileReadme: string;
      partial: string[];
    }>(
      { cmd: 'index-repos', user: user.trim() },
      (e) => e.type === 'progress' && set({ busy: { label: e.message, done: e.done, total: e.total } }),
      ctl.signal,
    );
    if (!r.ok) return set(fail(r.error));
    const old = get().meta;
    // Keep the projects the user dropped before.
    const dropped = new Set(old?.index.filter((c) => c.excluded).map((c) => c.id));
    const meta = {
      ...r.value.meta,
      index: r.value.meta.index.map((c) => ({ ...c, excluded: dropped.has(c.id) })),
    };
    await idbSet('meta', 'main', meta);
    const v = r.value;
    set({
      meta,
      busy: null,
      abort: null,
      notice: `Read all ${meta.projects.length} of your repositories${v.forks ? ` (${v.forks} forks left out)` : ''}${v.profileReadme ? '; your profile README is not treated as a project' : ''}.${v.partial.length ? ` ${v.partial.length} have little text (no README), so their bullets use the file list and description.` : ''}`,
    });
  },
  async excludeProject(id, excluded) {
    const m = get().meta;
    if (!m) return;
    const meta = { ...m, index: m.index.map((c) => (c.id === id ? { ...c, excluded } : c)) };
    await idbSet('meta', 'main', meta);
    set({ meta });
  },
  setStack(pid, stack) {
    set({ dirty: true });
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              projects: s.draft.projects.map((p) => (p.id === pid ? { ...p, stack } : p)),
            },
          }
        : s,
    );
  },
  importMeta(json) {
    const r = parseMetaFile(json);
    if (!r.ok) return set({ error: r.error });
    void idbSet('meta', 'main', r.value);
    set({ meta: r.value, notice: `Imported ${r.value.projects.length} projects.`, error: null });
  },
  exportMeta() {
    const m = get().meta;
    return m ? serializeMetaFile(m) : null;
  },
  async saveProfile(p) {
    await idbSet('profile', 'main', p);
    set({ profile: p, notice: 'Profile saved.' });
  },
  async saveDocs(d) {
    await idbSet('docs', 'main', d);
    set({ docs: d });
  },
  async readDocs(d) {
    const { settings } = get();
    if (!hasConsent(settings))
      return set(
        fail({ code: 'consent_required', message: 'Accept the privacy notice first.', retryable: false }),
      );
    const key = await loadApiKey();
    if (!key)
      return set(
        fail({ code: 'provider_auth', message: 'Add your API key in Settings first.', retryable: false }),
      );
    await get().saveDocs(d);
    const ctl = new AbortController();
    set({ busy: { label: 'Reading your documents' }, abort: ctl, error: null });
    const r = await pipelineWorker.call<{ profile: Profile; order: string[]; corpus: string }>(
      { cmd: 'extract-profile', docs: d, config: { settings, apiKey: key } },
      undefined,
      ctl.signal,
    );
    if (!r.ok) return set(fail(r.error));
    await idbSet('profile', 'main', r.value.profile);
    await idbSet('docs', 'read', { corpus: r.value.corpus, order: r.value.order });
    set({
      profile: r.value.profile,
      corpus: r.value.corpus,
      order: r.value.order,
      busy: null,
      abort: null,
      notice: 'Your documents were read. Check the details below.',
    });
  },
  async buildOwnTex() {
    const { docs, profile, draft, settings } = get();
    if (!draft) return;
    if (!docs.latex.trim())
      return set(
        fail({ code: 'validation', message: 'Paste your LaTeX resume in Details first.', retryable: false }),
      );
    const key = await loadApiKey();
    set({ busy: { label: 'Writing .tex in your format' }, error: null });
    const r = await pipelineWorker.call<string>({
      cmd: 'restyle-latex',
      latex: docs.latex,
      profile,
      draft,
      config: { settings, apiKey: key },
    });
    if (!r.ok) return set(fail(r.error));
    set({ texOwn: r.value, busy: null });
  },
  async startRun() {
    const { settings, meta, profile, job } = get();
    if (!hasConsent(settings))
      return set(
        fail({ code: 'consent_required', message: 'Accept the privacy notice first.', retryable: false }),
      );
    if (!meta) return set(fail({ code: 'not_found', message: 'Add your projects first.', retryable: false }));
    const key = await loadApiKey();
    if (!key)
      return set(
        fail({ code: 'provider_auth', message: 'Add your API key in Settings first.', retryable: false }),
      );
    const ctl = new AbortController();
    set({
      busy: { label: 'Reading the job posting', stage: 'sanitise' },
      error: null,
      notice: null,
      abort: ctl,
      run: null,
      draft: null,
      pdfUrl: null,
      sources: null,
      texOwn: null,
    });
    const r = await pipelineWorker.call<RunResult>(
      {
        cmd: 'run',
        jobText: job.text,
        meta,
        profile,
        corpus: get().corpus,
        order: get().order,
        latex: get().docs.latex,
        config: { settings, apiKey: key },
      },
      (e) =>
        e.type === 'progress' &&
        set({ busy: { label: e.message, done: e.done, total: e.total, stage: e.stage } }),
      ctl.signal,
    );
    if (!r.ok) return set({ ...fail(r.error), retry: 'run' });
    set({
      run: r.value,
      draft: r.value.draft,
      busy: null,
      abort: null,
      step: 'preview',
      retry: null,
      dirty: false,
    });
    if (settings.historyEnabled) {
      const item: HistoryItem = {
        id: String(Date.now()),
        at: new Date().toISOString(),
        title: r.value.job.title || job.title || 'Untitled job',
        url: job.url,
        draft: r.value.draft,
        picks: r.value.picks,
      };
      await idbSet('history', item.id, item);
      set((s) => ({ history: [item, ...s.history] }));
    }
    // The PDF is built straight away, so there is nothing to click for each job.
    await get().render();
  },
  cancel() {
    get().abort?.abort();
    set({ busy: null, abort: null });
  },
  editBullet(pid, bid, text) {
    set({ dirty: true });
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              projects: s.draft.projects.map((p) =>
                p.id === pid
                  ? {
                      ...p,
                      bullets: p.bullets.map((b) =>
                        b.id === bid ? { ...b, text, status: 'ok' as const, failures: [] } : b,
                      ),
                    }
                  : p,
              ),
            },
          }
        : s,
    );
  },
  removeBullet(pid, bid) {
    set({ dirty: true });
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              projects: s.draft.projects.map((p) =>
                p.id === pid ? { ...p, bullets: p.bullets.filter((b) => b.id !== bid) } : p,
              ),
            },
          }
        : s,
    );
  },
  async rewriteBullet(pid, bid, instruction) {
    const { meta, settings } = get();
    const entry = meta?.projects.find((p) => p.id === pid);
    if (!entry) return;
    const key = await loadApiKey();
    set({ busy: { label: 'Rewriting the bullet' }, error: null });
    const r = await pipelineWorker.call<{ text: string }>({
      cmd: 'rewrite-bullet',
      entry,
      bulletId: bid,
      instruction,
      config: { settings, apiKey: key },
    });
    if (!r.ok) return set(fail(r.error));
    get().editBullet(pid, bid, r.value.text);
    set({ busy: null });
  },
  async render() {
    const { draft, profile } = get();
    if (!draft) return;
    set({ busy: { label: 'Setting the page', stage: 'render' }, error: null });
    const r = await renderWorker.call<{
      pdf: Uint8Array;
      draft: ResumeDraft;
      pages: number;
      texSource: string;
      typstSource: string;
      steps: string[];
    }>({ cmd: 'render-pdf', profile, draft });
    if (!r.ok) return set({ ...fail(r.error), retry: 'render' });
    const old = get().pdfUrl;
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(new Blob([r.value.pdf as BlobPart], { type: 'application/pdf' }));
    set({
      pdfUrl: url,
      sources: {
        tex: r.value.texSource,
        typ: r.value.typstSource,
        steps: r.value.steps,
        pages: r.value.pages,
      },
      busy: null,
      step: 'preview',
      texOwn: null,
      dirty: false,
      retry: null,
    });
    // With a macro-based LaTeX resume, the .tex in the person's own format needs no model, so it is made right away.
    const { docs } = get();
    if (docs.latex.trim()) {
      const t = await pipelineWorker.call<string>({
        cmd: 'own-latex',
        latex: docs.latex,
        profile,
        draft: r.value.draft,
        smallerText: r.value.steps.includes('slightly smaller text'),
      });
      if (t.ok) set({ texOwn: t.value });
    }
  },
  openHistory(id) {
    const h = get().history.find((x) => x.id === id);
    if (h) set({ draft: h.draft, run: null, step: 'draft', view: 'job', pdfUrl: null, sources: null });
  },
  async deleteHistory(id) {
    await idbDelete('history', id);
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },
  async wipe() {
    await deleteAllData();
    set({
      settings: defaultSettings(),
      hasKey: false,
      meta: null,
      profile: emptyProfile(),
      docs: emptyDocs(),
      corpus: '',
      order: [],
      history: [],
      run: null,
      draft: null,
      pdfUrl: null,
      sources: null,
      notice: 'All data on this device was deleted.',
      view: 'projects',
      step: 'input',
    });
  },
  dismiss: () => set({ error: null, notice: null }),
}));
