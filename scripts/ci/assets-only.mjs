// Fails if wrangler.jsonc would deploy a Worker script. With static assets only, requests are
// free and never count as Worker invocations; a script would bill every request on Workers Paid.
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const FILE = new URL('../../wrangler.jsonc', import.meta.url);

const { config, error } = ts.parseConfigFileTextToJson(
  'wrangler.jsonc',
  await readFile(FILE, 'utf8'),
);
if (error) {
  console.error(`wrangler.jsonc: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
  process.exit(1);
}

// Top level plus any per-environment overrides.
const scopes = [
  ['top level', config],
  ...Object.entries(config.env ?? {}).map(([k, v]) => [`env.${k}`, v]),
];

const problems = [];
for (const [where, scope] of scopes) {
  if ('main' in scope) problems.push(`${where}: "main" adds a Worker script`);
  if (scope.assets?.run_worker_first)
    problems.push(`${where}: "assets.run_worker_first" runs a Worker before assets`);
  if (scope.assets?.binding)
    problems.push(`${where}: "assets.binding" is only for a Worker script`);
}

if (problems.length) {
  console.error('wrangler.jsonc must stay static assets only (see DEPLOY.md):');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('wrangler.jsonc: static assets only');
