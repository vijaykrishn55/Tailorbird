# Security and privacy

## Reporting a problem

Open a private security advisory on the GitHub repository, or email the maintainer. Please do not post details publicly before a fix is available.

## What leaves your device

- **To the AI provider you choose** (with your own API key): the job text, your project summaries and READMEs, and the text of the resume files you add in Details. Name, email, phone and links are replaced by placeholders first (see rule 3).
- **To GitHub** (`api.github.com`, `raw.githubusercontent.com`): requests for your public repositories. No login or token is used.
- **Nowhere else.** No server of ours, no analytics, no tracking, no remote code.

## Design rules (checked in code review and tests)

1. **API key**: stored only in `chrome.storage.local`. Never logged, exported, put in history or traces (traces are redacted).
2. **No network before consent**: nothing is sent until the privacy notice is accepted and the browser grants access to the provider's address.
3. **Contact details stay local**: name, email, phone and links are found with pattern matching on the device and are never sent to the provider. They are replaced by `[name]`, `[email]`, `[phone]` and `[link]` in the text that is sent, and are added back on the device. When you build a `.tex` in your own layout, your LaTeX preamble and header are kept as written and are not sent.
4. **Reading the page**: the text of a tab is read only when you press **Read this page**. Chrome may ask once for permission to read sites (an optional permission, not granted at install). The text is put in the job box for you to review. It is stored only if you turn on history.
5. **Job text is untrusted**: hidden characters are removed, the size is capped, the text is fenced as data, and only a structured profile reaches later steps. Model output is checked in code, so an injected instruction cannot add a fact.
6. **Nothing invented**: every bullet, summary line and skill is checked in code against your own documents and project facts. Numbers and technologies that are not in them are rejected, and failures fall back to your own wording.
7. **No remote code**: every script, the PDF engine (WebAssembly) and the font are bundled. No CDN. The extension page policy is `script-src 'self' 'wasm-unsafe-eval'`.
8. **Permissions**: `storage`, `sidePanel`, `activeTab`, `scripting`; hosts `api.github.com` and `raw.githubusercontent.com`. Optional, requested at run time: your provider's address, and reading the page you are on.
9. **LaTeX safety**: generated text is escaped and rejected if it contains a forbidden command (for example `\input`, `\write18`, `\def`). A model-written `.tex` may only use commands that already appear in your own LaTeX.
10. **Delete everything**: Settings has a button that removes all stored data and the key.

## Known limits

- The provider you choose sees the job text, project summaries and your resume text, including employers and achievements. Check its privacy terms.
- Contact details are found by patterns. An unusual format (for example a phone number split across lines) may be missed. Check the Details screen before you send.
- Bullets are verified against your project facts, but you remain responsible for what you send to employers.
