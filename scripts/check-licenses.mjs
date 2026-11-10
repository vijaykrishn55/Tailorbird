// Fails if any production dependency uses a licence that is not on the allow list.
import { execFileSync } from 'node:child_process';

const ALLOWED =
  /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|OFL-1\.1|CC0-1\.0|Unlicense|Python-2\.0|MIT-0)$/;
const out = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(out);
let bad = 0;
for (const [license, pkgs] of Object.entries(byLicense)) {
  // SPDX expressions such as "(MIT OR Apache-2.0)" pass when every alternative or any "OR" branch is allowed.
  const parts = license.replace(/[()]/g, '').split(/\s+OR\s+/);
  if (parts.some((p) => ALLOWED.test(p.trim()))) continue;
  bad++;
  console.error(
    `NOT ALLOWED: ${license}: ${pkgs.map((p) => `${p.name}@${p.versions.join(',')}`).join(', ')}`,
  );
}
console.log(
  bad ? `${bad} licence group(s) need review` : 'All production dependency licences are on the allow list.',
);
process.exit(bad ? 1 : 0);
