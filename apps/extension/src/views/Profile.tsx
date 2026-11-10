import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from '@ra/schemas';
import { pdfToText } from '../lib/pdf-input';
import { useStore } from '../lib/store';
import { Busy, Messages } from './common';

/** A text box that keeps what you type and only hands the value up when you leave it. Typing is never rewritten under you. */
function Field({
  label,
  value,
  onCommit,
  multiline,
  rows = 3,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const [v, setV] = useState(value);
  const id = useId();
  useEffect(() => setV(value), [value]);
  return (
    <>
      {label && <label htmlFor={id}>{label}</label>}
      {multiline ? (
        <textarea
          id={id}
          aria-label={label || undefined}
          rows={rows}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(v)}
        />
      ) : (
        <input
          id={id}
          aria-label={label || 'Link'}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(v)}
        />
      )}
    </>
  );
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function ProfileView() {
  const { profile, saveProfile, docs, saveDocs, readDocs, busy, setView } = useStore();
  const [p, setP] = useState<Profile>(profile);
  const [d, setD] = useState(docs);
  const [localErr, setLocalErr] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const slot = useRef(0);
  useEffect(() => setP(profile), [profile]);
  const upd = (next: Profile) => {
    setP(next);
    void saveProfile(next);
  };
  const setLatex = (latex: string) => setD((x) => ({ ...x, latex }));
  const setFile = (i: number, f: { name: string; text: string } | undefined) =>
    setD((x) => ({
      ...x,
      files: f ? Object.assign([...x.files], { [i]: f }) : x.files.filter((_, j) => j !== i),
    }));
  const addFile = async (file: File) => {
    setLocalErr('');
    try {
      const text = /\.pdf$/i.test(file.name) ? await pdfToText(file) : await file.text();
      setFile(slot.current, { name: file.name, text });
    } catch {
      setLocalErr('This file could not be read. Paste its text into the box instead.');
    }
  };
  const ready = d.latex.trim() || d.files.some((f) => f.text.trim());
  return (
    <main>
      <h1>Your details</h1>
      <Messages />
      <Busy />
      {localErr && (
        <div className="banner error" role="alert">
          {localErr}
        </div>
      )}
      <p className="muted">
        Add your documents once. Everything below, including name, email, phone and links, is read from them.
        Contact details are found on this device and are never sent to the AI.
      </p>
      <h2>1. Your LaTeX resume (format and content)</h2>
      <textarea
        aria-label="LaTeX resume"
        style={{ minHeight: 160, fontFamily: 'monospace' }}
        placeholder="Paste your LaTeX resume code here. The layout, section order and wording style come from this."
        value={d.latex}
        onChange={(e) => setLatex(e.target.value)}
        onBlur={() => void saveDocs(d)}
      />
      <h2>2. Up to two more files (for details)</h2>
      <p className="muted small">
        LinkedIn PDF, an old resume, notes. PDF, text, Markdown or LaTeX. Text is editable.
      </p>
      {[0, 1].map((i) => {
        const f = d.files[i];
        return (
          <div className="card" key={i}>
            {f ? (
              <>
                <strong>{f.name}</strong>
                <textarea
                  aria-label={`File ${i + 1} text`}
                  style={{ minHeight: 100 }}
                  value={f.text}
                  onChange={(e) => setFile(i, { ...f, text: e.target.value })}
                  onBlur={() => void saveDocs(d)}
                />
                <button onClick={() => setFile(i, undefined)}>Remove file</button>
              </>
            ) : (
              i <= d.files.length && (
                <button
                  disabled={!!busy}
                  onClick={() => {
                    slot.current = i;
                    picker.current?.click();
                  }}
                >
                  Add file {i + 1}
                </button>
              )
            )}
          </div>
        );
      })}
      <input
        ref={picker}
        type="file"
        accept=".pdf,.txt,.md,.tex,application/pdf,text/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) await addFile(f);
        }}
      />
      <div className="row">
        <button className="primary" disabled={!ready || !!busy} onClick={() => void readDocs(d)}>
          Read my details
        </button>
      </div>
      <h2>3. Check what was read</h2>
      <Field label="Full name" value={p.name} onCommit={(v) => upd({ ...p, name: v })} />
      <Field label="Email" value={p.email} onCommit={(v) => upd({ ...p, email: v })} />
      <Field label="Phone" value={p.phone} onCommit={(v) => upd({ ...p, phone: v })} />
      <Field label="Headline" value={p.headline} onCommit={(v) => upd({ ...p, headline: v })} />
      <Field label="Summary" value={p.summary ?? ''} multiline onCommit={(v) => upd({ ...p, summary: v })} />
      <label>Links</label>
      {p.links.map((l, i) => (
        <div className="row" key={i}>
          <Field
            label=""
            value={l.label}
            onCommit={(v) => upd({ ...p, links: p.links.map((x, j) => (j === i ? { ...x, label: v } : x)) })}
          />
          <Field
            label=""
            value={l.url}
            onCommit={(v) => upd({ ...p, links: p.links.map((x, j) => (j === i ? { ...x, url: v } : x)) })}
          />
          <button onClick={() => upd({ ...p, links: p.links.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      <button onClick={() => upd({ ...p, links: [...p.links, { label: 'Link', url: 'https://' }] })}>
        Add link
      </button>
      <Field
        label="Skills (one group per line: Label: a, b, c)"
        multiline
        rows={5}
        value={p.skills.map((g) => `${g.label}: ${g.items.join(', ')}`).join('\n')}
        onCommit={(v) =>
          upd({
            ...p,
            skills: lines(v)
              .map((x) => {
                const i = x.indexOf(':');
                return i > 0
                  ? {
                      label: x.slice(0, i).trim(),
                      items: x
                        .slice(i + 1)
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }
                  : null;
              })
              .filter((g): g is { label: string; items: string[] } => !!g && g.items.length > 0),
          })
        }
      />
      <Field
        label="Experience (Title | Org | Dates | Location, then bullets starting with -; blank line between jobs)"
        multiline
        rows={9}
        value={p.experience
          .map(
            (x) =>
              `${x.title} | ${x.org} | ${x.dates} | ${x.location}\n${x.bullets.map((b) => `- ${b}`).join('\n')}`,
          )
          .join('\n\n')}
        onCommit={(v) =>
          upd({
            ...p,
            experience: v
              .split(/\n\s*\n/)
              .map((blk) => {
                const [head, ...rest] = blk.split('\n');
                const h = (head ?? '').split('|').map((s) => s.trim());
                return h[0]
                  ? {
                      title: h[0],
                      org: h[1] ?? '',
                      dates: h[2] ?? '',
                      location: h[3] ?? '',
                      bullets: rest.map((r) => r.replace(/^-\s*/, '').trim()).filter(Boolean),
                    }
                  : null;
              })
              .filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      />
      <Field
        label="Education (School | Degree | Dates | Detail, one per line)"
        multiline
        rows={4}
        value={p.education.map((x) => [x.school, x.degree, x.dates, x.detail].join(' | ')).join('\n')}
        onCommit={(v) =>
          upd({
            ...p,
            education: lines(v)
              .map((x) => x.split('|').map((s) => s.trim()))
              .map((x) => ({ school: x[0]!, degree: x[1] ?? '', dates: x[2] ?? '', detail: x[3] ?? '' })),
          })
        }
      />
      <Field
        label="Certifications (one per line)"
        multiline
        value={p.certifications.join('\n')}
        onCommit={(v) => upd({ ...p, certifications: lines(v) })}
      />
      <div className="row">
        <button className="primary" onClick={() => setView('job')}>
          Go to job
        </button>
      </div>
    </main>
  );
}
