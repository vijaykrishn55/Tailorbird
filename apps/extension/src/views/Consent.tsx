import { useStore } from '../lib/store';
import { BirdMark } from './common';

export function Consent() {
  const accept = useStore((s) => s.acceptConsent);
  return (
    <main>
      <div className="hero">
        <BirdMark size={56} />
        <h1>Before you start</h1>
      </div>
      <p>Tailorbird works on your device. It has no server and no account.</p>
      <h2>What is sent, and where</h2>
      <ul>
        <li>
          The text of a job posting, your project summaries and the stack of each project go to{' '}
          <strong>the AI provider you choose</strong>, using <strong>your own API key</strong>.
        </li>
        <li>
          Your resume files are read on this device. Your name, email, phone and links are found on this
          device and replaced by placeholders before any text is sent. They are added to the PDF locally.
        </li>
        <li>
          Public repository files are read from GitHub (api.github.com and raw.githubusercontent.com). No
          GitHub login is used.
        </li>
        <li>Nothing else leaves your device. There is no analytics and no tracking.</li>
      </ul>
      <h2>What is stored</h2>
      <p>
        Your project list, profile and history are kept in this browser. Your API key is kept in this
        browser's extension storage and is never shown, logged or exported. You can delete everything in
        Settings.
      </p>
      <p className="muted small">
        Each provider has its own privacy terms. Check them before you send personal text.
      </p>
      <div className="row">
        <button className="primary" onClick={() => void accept()}>
          I understand, continue
        </button>
      </div>
    </main>
  );
}
