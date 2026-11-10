import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { downloadText } from '../lib/download';
import { Busy, Messages } from './common';

export function Projects() {
  const { meta, indexGithub, importMeta, exportMeta, busy, excludeProject } = useStore();
  const [showHidden, setShowHidden] = useState(true);
  const [user, setUser] = useState(meta?.githubUser ?? '');
  const file = useRef<HTMLInputElement>(null);
  return (
    <main>
      <h1>Your projects</h1>
      <Messages />
      <Busy />
      <p className="muted">
        Add your GitHub username. Every public repository is read (README, files, dependencies). Nothing is
        skipped. Use Remove on any project you never want picked.
      </p>
      <label htmlFor="gh">GitHub username</label>
      <div className="row">
        <input
          id="gh"
          style={{ flex: 1 }}
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="e.g. octocat"
        />
        <button className="primary" disabled={!user.trim() || !!busy} onClick={() => void indexGithub(user)}>
          {meta ? 'Refresh' : 'Read projects'}
        </button>
      </div>
      <h2>Or use a meta file</h2>
      <div className="row">
        <button onClick={() => file.current?.click()}>Import meta file</button>
        <button
          disabled={!meta}
          onClick={() => {
            const t = exportMeta();
            if (t) downloadText('resume-meta.json', t, 'application/json');
          }}
        >
          Export
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) importMeta(await f.text());
            e.target.value = '';
          }}
        />
      </div>
      {meta && (
        <>
          <h2>
            {meta.projects.length} projects, {meta.index.filter((c) => c.excluded).length} removed
          </h2>
          <label>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />{' '}
            Show removed
          </label>
          {meta.index
            .filter((c) => showHidden || !c.excluded)
            .map((c) => {
              const p = meta.projects.find((x) => x.id === c.id);
              return (
                <div className="card" key={c.id} style={c.excluded ? { opacity: 0.55 } : undefined}>
                  <strong>{p?.name ?? c.id}</strong>
                  <div className="small muted">{c.oneLine}</div>
                  <div>
                    {c.kw.slice(0, 8).map((k) => (
                      <span className="chip" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                  <div className="row">
                    <button onClick={() => void excludeProject(c.id, !c.excluded)}>
                      {c.excluded ? 'Restore' : 'Remove from list'}
                    </button>
                  </div>
                </div>
              );
            })}
        </>
      )}
    </main>
  );
}
