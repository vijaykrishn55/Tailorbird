import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

// Permissions are deliberately minimal. See docs/SECURITY.md.
export default defineConfig({
  srcDir: 'src',
  zip: { artifactTemplate: 'tailorbird-{{version}}-{{browser}}.zip' },
  outDir: 'dist',
  vite: () => ({
    plugins: [react()],
    build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
    worker: { format: 'es' as const },
  }),
  manifest: ({ browser }) => ({
    name: 'Tailorbird',
    description:
      'Cuts a one-page resume to fit each job: picks your best projects and checks every bullet against your code. Your data stays on your device.',
    version: '0.1.0',
    minimum_chrome_version: '116',
    permissions:
      browser === 'firefox'
        ? ['storage', 'activeTab', 'scripting']
        : ['storage', 'sidePanel', 'activeTab', 'scripting'],
    host_permissions: ['https://api.github.com/*', 'https://raw.githubusercontent.com/*'],
    optional_host_permissions: ['*://*/*'],
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    action: { default_title: 'Tailorbird' },
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
  }),
});
