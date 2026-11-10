# Tailorbird

A browser extension that cuts a one-page resume to fit each job. It picks your best GitHub projects for a posting, writes three bullets for each one, and checks every bullet against your real code before it reaches the page.

It runs on your device. No server, no account, no tracking. Works in Chrome and Edge. MIT licensed.

## How it works

1. **Projects:** reads all your public GitHub repos (README, file list, dependencies) into a project bank. You can remove any project you never want picked.
2. **Details:** you paste your LaTeX resume and add up to two more files (for example a LinkedIn PDF). Tailorbird reads your name, contact links, skills, experience and education from them.
3. **Job:** it reads the posting from the open tab, or from pasted text, and pulls out the required skills.
4. **Write:** it ranks your projects, then writes three bullets and a small tech-stack line for each of the best three. It also tailors your summary and skills. Every bullet is checked in code: numbers and technologies must come from the project, forbidden claims are rejected, and anything that fails is retried and then replaced by your own wording.
5. **PDF:** the one-page PDF is built right away in the browser. If you pasted a LaTeX resume that uses macros such as `\projectHeader`, you also get a `.tex` file in your own layout.

## Install

**From the store:** search for Tailorbird in the Chrome Web Store or Edge Add-ons (link here once published).

**From a release zip:** download the zip, unzip it, open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked**, and select the unzipped folder.

**From source:** needs Node 20+ and pnpm.

```
pnpm install
pnpm build        # output: apps/extension/dist/chrome-mv3
```

Then load `apps/extension/dist/chrome-mv3` as above.

## Use it

1. Click the toolbar icon to open the side panel and accept the privacy notice.
2. **Settings:** pick an AI provider and paste your API key. Any OpenAI-compatible service works. The defaults are Groq's `gpt-oss` models.
3. **Projects:** enter your GitHub username and press **Read projects**. This needs no API key.
4. **Details:** paste your LaTeX resume, add up to two other files, and press **Read my details**. Check what was read.
5. **Job:** open a job posting and press **Read this page**, or paste the text. Chrome may ask once for permission to read the page. Then press **Find best projects and write**.
6. The PDF opens first. Check the **Projects** and **Bullets** tabs if you want to change anything. The PDF updates when you go back to it.

## Privacy

Job text, project summaries and your resume text go to the AI provider you choose, using your own API key. Your name, email, phone and links are found on your device and replaced by placeholders before anything is sent. See [SECURITY.md](SECURITY.md).

## Limits

- The PDF preview follows your layout closely but is built with a different typesetter, so it is not identical to LaTeX. For the exact look, compile the `.tex` file.
- Exact fidelity of the `.tex` needs your LaTeX to use header and item macros. Other layouts are rewritten section by section by the model and checked.
- Results depend on the AI model you use.

## Develop

```
pnpm test         # unit tests
pnpm eval         # offline quality checks
pnpm e2e          # loads the built extension in Chromium (set CHROMIUM_PATH if needed)
pnpm lint
pnpm zip          # store-ready zip
```

`packages/` holds the engine (schemas, providers, retrieval, verify, indexer, latex, core, eval). `apps/extension/` holds the extension.

## Licence

MIT. See [LICENSE](LICENSE). Third-party software is listed in [NOTICE](NOTICE).
