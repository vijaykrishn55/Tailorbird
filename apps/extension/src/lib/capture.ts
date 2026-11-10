/** Read the text of the active tab only after the user clicks. Runs inside the page, so it must be self-contained. */
export interface Captured {
  title: string;
  url: string;
  text: string;
}

function readPage(): { title: string; url: string; text: string } {
  const sel = window.getSelection()?.toString().trim() ?? '';
  const root = document.querySelector('main, [role="main"], article') ?? document.body;
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      'script, style, noscript, nav, header, footer, aside, iframe, svg, [hidden], [aria-hidden="true"]',
    )
    .forEach((n) => n.remove());
  const text = sel.length > 200 ? sel : (clone.innerText || clone.textContent || '').trim();
  return { title: document.title, url: location.href, text };
}

const ALL_SITES = { origins: ['*://*/*'] };

async function readTab(tabId: number): Promise<Captured | undefined> {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: readPage,
  });
  // Job boards often render the posting inside a frame: the longest text wins.
  const texts = results.map((r) => r.result as Captured | undefined).filter((r): r is Captured => !!r);
  return texts.sort((a, b) => b.text.length - a.text.length)[0];
}

/** Read the page the user is looking at. Works on any http(s) page; asks once for access if Chrome has not granted it. */
export async function captureActiveTab(): Promise<Captured> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('No tab is open.');
  let r: Captured | undefined;
  try {
    r = await readTab(tab.id);
  } catch {
    // No access to this tab yet. Ask for it (this runs inside the click, so Chrome allows the prompt).
    const granted = await chrome.permissions.request(ALL_SITES).catch(() => false);
    if (!granted) throw new Error('Access to the page was not granted. Allow it, or paste the text instead.');
    try {
      r = await readTab(tab.id);
    } catch {
      throw new Error(
        'Chrome does not let extensions read this page (for example chrome:// or the Web Store). Paste the text instead.',
      );
    }
  }
  if (!r || r.text.length < 40)
    throw new Error(
      'No readable text was found on this page. Select the job description and try again, or paste it.',
    );
  return r;
}

export { readPage as _readPageForTest };
