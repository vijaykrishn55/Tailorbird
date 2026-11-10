import { useEffect, useState } from 'react';
import { ERROR_HELP } from '@ra/schemas';
import { useStore } from '../lib/store';

export function Messages() {
  const { error, notice, dismiss, retry, tryAgain, busy } = useStore();
  return (
    <div aria-live="polite">
      {error && (
        <div className="banner error" role="alert">
          <strong>{ERROR_HELP[error.code].message}</strong>{' '}
          {error.message !== ERROR_HELP[error.code].message ? error.message : ''}
          <div className="small">{ERROR_HELP[error.code].action}</div>
          {error.detail && <div className="small muted">Details: {error.detail}</div>}
          {retry && (
            <button className="primary" disabled={!!busy} onClick={() => void tryAgain()}>
              Try again
            </button>
          )}{' '}
          <button onClick={dismiss}>Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="banner ok">
          {notice} <button onClick={dismiss}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

export function BirdMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="bird" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <path d="M10 44 C 8 52, 18 56, 24 50" className="bird-thread" />
      <path
        d="M12 41 C18 28 29 21 42 22 C47 22.4 51 25 53 29 C48 28 44 30 40 34 C34 40 25 43 12 41 Z"
        className="bird-body"
      />
      <path d="M12 41 L6 37 M12 41 L7 46.5" className="bird-tail" />
      <path d="M26 33 C31 29 38 28.5 43 31 C38 36 32 38.5 26 38.5 Z" className="bird-wing" />
      <path d="M30 39 C36 38 42 34 46 31.5 C44 37 38 42 30 43 Z" className="bird-belly" />
      <path d="M53 29 L61 31.5 L53 33.5 Z" className="bird-beak" />
      <circle cx="47" cy="27.4" r="1.5" className="bird-eye" />
    </svg>
  );
}

export function Brand() {
  return (
    <header className="brand">
      <span className="brand-chip">
        <BirdMark size={26} />
      </span>
      <span className="brand-name">Tailorbird</span>
      <span className="brand-tag">a resume cut to fit each job</span>
    </header>
  );
}

const STEPS = [
  { key: 'read', label: 'Read the job', stages: ['sanitise', 'analyse'] },
  { key: 'pick', label: 'Pick projects', stages: ['rank'] },
  { key: 'write', label: 'Write bullets', stages: ['generate'] },
  { key: 'check', label: 'Check facts', stages: ['verify'] },
  { key: 'tailor', label: 'Tailor the rest', stages: ['summary'] },
  { key: 'pdf', label: 'Build the PDF', stages: ['render'] },
] as const;

function useElapsed(active: boolean): number {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!active) return setSec(0);
    const t = window.setInterval(() => setSec((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return sec;
}

/** A thread the bird follows. Known progress fills the stitches; unknown progress lets the bird glide back and forth. */
function Thread({ pct }: { pct?: number }) {
  return (
    <div className={`thread ${pct === undefined ? 'glide' : ''}`} aria-hidden="true">
      <i className="thread-fill" style={pct === undefined ? undefined : { width: `${pct}%` }} />
      <span className="thread-bird" style={pct === undefined ? undefined : { left: `${pct}%` }}>
        <BirdMark size={30} />
      </span>
    </div>
  );
}

export function Busy() {
  const { busy, cancel } = useStore();
  const sec = useElapsed(!!busy);
  if (!busy) return null;
  const stepIdx = busy.stage
    ? STEPS.findIndex((x) => (x.stages as readonly string[]).includes(busy.stage!))
    : -1;
  const frac = busy.total ? Math.min(1, (busy.done ?? 0) / busy.total) : 0;
  const pct =
    stepIdx >= 0
      ? Math.round(((stepIdx + (busy.total ? frac : 0.35)) / STEPS.length) * 100)
      : busy.total
        ? Math.round(frac * 100)
        : undefined;
  return (
    <div className="stitching" role="status" aria-live="polite">
      <Thread pct={pct} />
      <div className="stitching-label">{busy.label}</div>
      {stepIdx >= 0 && (
        <ol className="steps">
          {STEPS.map((st, i) => (
            <li key={st.key} className={i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}>
              <span className="dot" aria-hidden="true" />
              {st.label}
            </li>
          ))}
        </ol>
      )}
      <div className="stitching-foot">
        <span className="muted small">
          {busy.total ? `${busy.done ?? 0} of ${busy.total} · ` : ''}
          {sec}s
        </span>
        <button onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

/** A blank page that shimmers while the PDF is being built. */
export function PaperSkeleton() {
  return (
    <div className="paper" aria-hidden="true">
      <i style={{ width: '46%', height: 16, margin: '0 auto 8px' }} />
      <i style={{ width: '70%', margin: '0 auto 16px' }} />
      {[92, 100, 86, 0, 100, 94, 88, 97, 0, 100, 90, 84, 100, 92].map((w, k) =>
        w === 0 ? <b key={k} /> : <i key={k} style={{ width: `${w}%` }} />,
      )}
    </div>
  );
}
