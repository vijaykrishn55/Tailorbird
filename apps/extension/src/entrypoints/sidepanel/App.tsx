import { useEffect } from 'react';
import { hasConsent } from '../../lib/settings';
import { useStore, type View } from '../../lib/store';
import { Brand } from '../../views/common';
import { Consent } from '../../views/Consent';
import { HistoryView } from '../../views/History';
import { JobView } from '../../views/Job';
import { ProfileView } from '../../views/Profile';
import { Projects } from '../../views/Projects';
import { Result } from '../../views/Result';
import { SettingsView } from '../../views/Settings';

const TABS: [View, string][] = [
  ['job', 'Job'],
  ['projects', 'Projects'],
  ['profile', 'Details'],
  ['history', 'History'],
  ['settings', 'Settings'],
];

export function App() {
  const { ready, init, settings, view, setView, step, run, draft } = useStore();
  useEffect(() => void init(), [init]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === 'system' ? '' : settings.theme;
  }, [settings.theme]);
  if (!ready)
    return (
      <main>
        <p className="muted">Loading…</p>
      </main>
    );
  if (!hasConsent(settings)) return <Consent />;
  const showResult = view === 'job' && (run || draft) && step !== 'input';
  return (
    <>
      <Brand />
      <nav aria-label="Main">
        {TABS.map(([k, label]) => (
          <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </nav>
      {view === 'job' &&
        (showResult ? (
          <>
            <Result />
            <div style={{ padding: '0 14px 24px' }}>
              <button onClick={() => useStore.getState().setStep('input')}>New job</button>
            </div>
          </>
        ) : (
          <JobView />
        ))}
      {view === 'projects' && <Projects />}
      {view === 'profile' && <ProfileView />}
      {view === 'history' && <HistoryView />}
      {view === 'settings' && <SettingsView />}
    </>
  );
}
