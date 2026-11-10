import { useState } from 'react';
import { loadApiKey } from '../lib/settings';
import { useStore } from '../lib/store';
import { Messages } from './common';

export function SettingsView() {
  const { settings, hasKey, updateSettings, wipe } = useStore();
  const [s, setS] = useState(settings);
  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState(false);
  const p = s.provider;
  return (
    <main>
      <h1>Settings</h1>
      <Messages />
      <h2>AI provider</h2>
      <p className="muted small">
        Any OpenAI-compatible service works. The default is Groq. Your key stays in this browser.
      </p>
      <label htmlFor="name">Provider name</label>
      <input
        id="name"
        value={p.name}
        onChange={(e) => setS({ ...s, provider: { ...p, name: e.target.value } })}
      />
      <label htmlFor="base">Base address</label>
      <input
        id="base"
        value={p.baseUrl}
        onChange={(e) => setS({ ...s, provider: { ...p, baseUrl: e.target.value } })}
      />
      <label htmlFor="key">API key {hasKey && <span className="chip hit">saved</span>}</label>
      <input
        id="key"
        type="password"
        autoComplete="off"
        placeholder={hasKey ? 'Saved. Type to replace.' : 'Paste your key'}
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <label htmlFor="fast">Fast model (reading and ranking)</label>
      <input
        id="fast"
        value={p.fastModel}
        onChange={(e) => setS({ ...s, provider: { ...p, fastModel: e.target.value } })}
      />
      <label htmlFor="strong">Strong model (writing bullets)</label>
      <input
        id="strong"
        value={p.strongModel}
        onChange={(e) => setS({ ...s, provider: { ...p, strongModel: e.target.value } })}
      />
      <h2>Limits</h2>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label htmlFor="rpm">Requests per minute</label>
          <input
            id="rpm"
            type="number"
            min={1}
            value={s.limits.requestsPerMinute}
            onChange={(e) =>
              setS({ ...s, limits: { ...s.limits, requestsPerMinute: Number(e.target.value) || 1 } })
            }
          />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="tpm">Tokens per minute</label>
          <input
            id="tpm"
            type="number"
            min={500}
            value={s.limits.tokensPerMinute}
            onChange={(e) =>
              setS({ ...s, limits: { ...s.limits, tokensPerMinute: Number(e.target.value) || 500 } })
            }
          />
        </div>
      </div>
      <h2>Appearance and history</h2>
      <label htmlFor="theme">Theme</label>
      <select
        id="theme"
        value={s.theme}
        onChange={(e) => {
          const theme = e.target.value as typeof s.theme;
          setS({ ...s, theme });
        }}
      >
        <option value="system">Match system</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <label>
        <input
          type="checkbox"
          style={{ width: 'auto' }}
          checked={s.historyEnabled}
          onChange={(e) => setS({ ...s, historyEnabled: e.target.checked })}
        />{' '}
        Keep a history of drafts on this device
      </label>
      <div className="row">
        <button
          className="primary"
          onClick={async () => {
            if (key.trim()) {
              await updateSettings(s, key);
              setKey('');
            } else {
              await updateSettings(s, (await loadApiKey()) === '' ? undefined : undefined);
            }
            document.documentElement.dataset.theme = s.theme === 'system' ? '' : s.theme;
          }}
        >
          Save
        </button>
      </div>
      <h2>Delete my data</h2>
      <p className="muted small">
        Removes your projects, profile, history, settings and API key from this browser.
      </p>
      {!confirm ? (
        <button className="danger" onClick={() => setConfirm(true)}>
          Delete all data…
        </button>
      ) : (
        <div className="row">
          <button
            className="danger"
            onClick={() => {
              void wipe();
              setConfirm(false);
            }}
          >
            Yes, delete everything
          </button>
          <button onClick={() => setConfirm(false)}>Keep my data</button>
        </div>
      )}
      <p className="muted small">
        Tailorbird is open source (MIT). Third-party notices are in the NOTICE file of the project.
      </p>
    </main>
  );
}
