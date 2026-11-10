import { useStore } from '../lib/store';
import { Busy, Messages } from './common';

export function JobView() {
  const { job, setJob, captureJob, startRun, busy, meta, hasKey, setView } = useStore();
  return (
    <main>
      <h1>Job</h1>
      <Messages />
      <Busy />
      {!meta && (
        <div className="banner warn">
          Add your projects first. <button onClick={() => setView('projects')}>Go to projects</button>
        </div>
      )}
      {!hasKey && (
        <div className="banner warn">
          Add your API key. <button onClick={() => setView('settings')}>Go to settings</button>
        </div>
      )}
      <p className="muted">Open a job posting, then read the page. You can also paste the text.</p>
      <div className="row">
        <button onClick={() => void captureJob()} disabled={!!busy}>
          Read this page
        </button>
      </div>
      <label htmlFor="jd">Job description</label>
      <textarea
        id="jd"
        style={{ minHeight: 200 }}
        value={job.text}
        onChange={(e) => setJob({ text: e.target.value })}
      />
      {job.title && <p className="small muted">From: {job.title}</p>}
      <div className="row">
        <button
          className="primary"
          disabled={!!busy || job.text.trim().length < 40 || !meta || !hasKey}
          onClick={() => void startRun()}
        >
          Find best projects and write
        </button>
      </div>
      <p className="muted small">The job text is treated as data only. Instructions inside it are ignored.</p>
    </main>
  );
}
