import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { downloadText, downloadUrl } from '../lib/download';
import { Busy, Messages, PaperSkeleton } from './common';

function Steps() {
  const step = useStore((s) => s.step);
  const setStep = useStore((s) => s.setStep);
  const list = [
    ['preview', 'PDF'],
    ['ranking', 'Projects'],
    ['draft', 'Bullets'],
  ] as const;
  return (
    <div className="row" role="tablist">
      {list.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={step === k}
          className={step === k ? 'primary' : ''}
          onClick={() => setStep(k)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Ranking() {
  const { run, meta, setStep, excludeProject, startRun, busy } = useStore();
  if (!run) return <p className="muted">Run a job first.</p>;
  return (
    <>
      <h2>
        {run.job.title || 'Job'} <span className="chip">{run.job.roleCode}</span>
      </h2>
      <div>
        {run.job.mustHave.map((t) => (
          <span key={t} className={`chip ${run.coverage.covered.includes(t) ? 'hit' : 'gap'}`}>
            {t}
          </span>
        ))}
      </div>
      <h2>Best projects</h2>
      {run.picks.map((p, i) => {
        const name = meta?.projects.find((x) => x.id === p.id)?.name ?? p.id;
        return (
          <div className="card" key={p.id}>
            <strong>
              {i + 1}. {name}
            </strong>
            <div className="small muted">{p.reason}</div>
            <button
              disabled={!!busy}
              onClick={async () => {
                await excludeProject(p.id, true);
                await startRun();
              }}
            >
              Drop this project and re-pick
            </button>
          </div>
        );
      })}
      <div className="row">
        <button className="primary" onClick={() => setStep('draft')}>
          Review bullets
        </button>
      </div>
    </>
  );
}

export function Draft() {
  const { draft, run, setStack, editBullet, removeBullet, rewriteBullet, busy } = useStore();
  const [instr, setInstr] = useState('Make it more specific to the job keywords, using only the facts.');
  if (!draft) return <p className="muted">Nothing to review yet.</p>;
  const gaps = draft.gaps;
  return (
    <>
      {draft.summary && (
        <div className="card">
          <strong>Summary</strong>
          <p>{draft.summary}</p>
        </div>
      )}
      {(run?.notes ?? []).map((n) => (
        <div className="banner warn small" key={n}>
          {n}
        </div>
      ))}
      {draft.projects.map((p) => (
        <div className="card" key={p.id}>
          <strong>{p.name}</strong>
          <label className="small">Tech stack line (small italic text under the bullets)</label>
          <input
            defaultValue={p.stack.join(', ')}
            onBlur={(e) =>
              setStack(
                p.id,
                e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
          {p.bullets.map((b) => (
            <div className={`bullet ${b.status === 'failed' ? 'failed' : ''}`} key={b.id}>
              <textarea
                aria-label={`Bullet ${b.id}`}
                style={{ minHeight: 64 }}
                value={b.text}
                onChange={(e) => editBullet(p.id, b.id, e.target.value)}
              />
              {b.status === 'failed' && (
                <div className="small" style={{ color: 'var(--danger)' }}>
                  Not used in the PDF: {b.failures.join('; ')}. Edit it to include it.
                </div>
              )}
              {b.failures.length > 0 && b.status === 'ok' && (
                <div className="small" style={{ color: 'var(--warning)' }}>
                  Used your saved wording because the new text did not pass checks.
                </div>
              )}
              <div className="row">
                <button disabled={!!busy} onClick={() => void rewriteBullet(p.id, b.id, instr)}>
                  Rewrite
                </button>
                <button onClick={() => removeBullet(p.id, b.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      <label htmlFor="ins">Rewrite instruction</label>
      <input id="ins" value={instr} onChange={(e) => setInstr(e.target.value)} />
      {gaps.length > 0 && (
        <>
          <h2>Keyword gaps</h2>
          {gaps.map((g) => (
            <div key={g.term} className="small">
              <span className="chip gap">{g.term}</span>{' '}
              {g.reason === 'no_evidence'
                ? 'No project of yours shows this. It is left out on purpose.'
                : 'You have this skill, but it did not fit in the chosen projects.'}
            </div>
          ))}
        </>
      )}
      {run && (
        <p className="muted small">Coverage of required keywords: {Math.round(run.coverage.ratio * 100)}%</p>
      )}
      <p className="muted small">Changes here are put into the PDF when you open the PDF tab.</p>
    </>
  );
}

export function Preview() {
  const { pdfUrl, sources, draft, render, busy, run, texOwn, buildOwnTex, docs, dirty, startRun } =
    useStore();
  // Edits made on the other tabs are put into the PDF as soon as this tab opens.
  useEffect(() => {
    if (dirty && draft && !busy) void render();
  }, [dirty]);
  if (!pdfUrl || !sources)
    return busy ? <PaperSkeleton /> : <p className="muted">No resume yet. Read a job posting to start.</p>;
  return (
    <>
      {sources.pages > 1 ? (
        <div className="banner warn">The resume is {sources.pages} pages. Remove a bullet and rebuild.</div>
      ) : (
        <div className="banner ok pop">
          One page. {sources.steps.length ? `Adjusted: ${sources.steps.join(', ')}.` : ''}
        </div>
      )}
      <iframe className="pdf" title="Resume preview" src={pdfUrl} />
      <div className="row">
        <button className="primary" onClick={() => downloadUrl('resume.pdf', pdfUrl)}>
          Download PDF
        </button>
        <button onClick={() => downloadText('resume.tex', sources.tex, 'application/x-tex')}>.tex</button>
        <button onClick={() => downloadText('resume.typ', sources.typ)}>.typ</button>
        <button disabled={!!busy || !docs.latex.trim()} onClick={() => void buildOwnTex()}>
          Build .tex in my format
        </button>
        {texOwn && (
          <button
            className="primary"
            onClick={() => downloadText('resume-my-format.tex', texOwn, 'application/x-tex')}
          >
            Download my-format .tex
          </button>
        )}
        {run && (
          <button onClick={() => downloadText('run-trace.json', run.trace, 'application/json')}>
            Run details
          </button>
        )}
        <button disabled={!!busy} onClick={() => void startRun()}>
          Regenerate
        </button>
      </div>
      <p className="muted small">
        The PDF is built with the app's own layout, which approximates yours. “Build .tex in my format”
        rewrites your pasted LaTeX with the new content, keeping your preamble and header, so compile it for
        the exact look. Run details have your email, phone and keys removed.
      </p>
    </>
  );
}

export function Result() {
  const step = useStore((s) => s.step);
  return (
    <main>
      <h1>Result</h1>
      <Messages />
      <Busy />
      <Steps />
      {step === 'ranking' && <Ranking />}
      {step === 'draft' && <Draft />}
      {step === 'preview' && <Preview />}
    </main>
  );
}
