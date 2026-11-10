import { useStore } from '../lib/store';

export function HistoryView() {
  const { history, openHistory, deleteHistory, settings } = useStore();
  return (
    <main>
      <h1>History</h1>
      {!settings.historyEnabled && <p className="muted">History is off. Turn it on in Settings.</p>}
      {history.length === 0 && (
        <p className="muted">Nothing here yet. Drafts you make will appear here, on this device only.</p>
      )}
      {history.map((h) => (
        <div className="card" key={h.id}>
          <strong>{h.title}</strong>
          <div className="small muted">{new Date(h.at).toLocaleString()}</div>
          <div className="row">
            <button onClick={() => openHistory(h.id)}>Open</button>
            <button className="danger" onClick={() => void deleteHistory(h.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
