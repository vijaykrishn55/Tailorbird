import { CONSENT_VERSION, Settings, defaultSettings } from '@ra/schemas';

const SETTINGS_KEY = 'settings';
const KEY_KEY = 'apiKey';

/** The API key lives only in chrome.storage.local. It is never logged, exported or put in history. */
export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  const parsed = Settings.safeParse(r[SETTINGS_KEY] ?? {});
  return parsed.success ? parsed.data : defaultSettings();
}
export const saveSettings = (s: Settings) => chrome.storage.local.set({ [SETTINGS_KEY]: s });
export async function loadApiKey(): Promise<string> {
  const r = await chrome.storage.local.get(KEY_KEY);
  return typeof r[KEY_KEY] === 'string' ? (r[KEY_KEY] as string) : '';
}
export const saveApiKey = (k: string) => chrome.storage.local.set({ [KEY_KEY]: k.trim() });
export const hasConsent = (s: Settings) => s.consentVersion >= CONSENT_VERSION;

/** Ask the browser for permission to contact the provider's origin. Nothing is sent before this succeeds. */
export async function requestProviderAccess(baseUrl: string): Promise<boolean> {
  let origin: string;
  try {
    const u = new URL(baseUrl);
    if (
      u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))
    )
      return false;
    origin = `${u.origin}/*`;
  } catch {
    return false;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

export async function deleteAllData(): Promise<void> {
  const { idbClearAll } = await import('./idb');
  await idbClearAll();
  await chrome.storage.local.clear();
  try {
    await chrome.permissions.remove({ origins: ['https://*/*'] });
  } catch {
    /* optional permissions may not be removable; ignore */
  }
}
