#!/usr/bin/env node
/* Exercises the redirect logic in bess-tracker-redirect/ by pulling the <script>
   out of each generated file and running it against a stubbed `location`, so the
   assertions test what actually ships rather than a re-typed copy.
   Run: node test-bess-tracker-redirect.js */
const fs = require('fs');
const D = 'bess-tracker-redirect/';

function runScript(file, url) {
  const html = fs.readFileSync(D + file, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  const u = new URL(url);
  let landed = null;
  const location = {
    pathname: u.pathname, search: u.search, hash: u.hash, origin: u.origin,
    replace: (x) => { landed = x; },
  };
  new Function('location', m[1])(location);
  return landed;
}

const OLD = 'https://starrysidekick.github.io/bess-tracker';
const NEW = 'https://starrysidekick.github.io/CEAC-Dashboard';
let fail = 0;
const check = (got, want, name) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + '\n        -> ' + got + (ok ? '' : '\n        want ' + want));
};

// The ten deep links baked into the already-distributed resource-roundup PDF.
const anchors = ['ceac-bess-slide-deck','clean-energy-workforce','climate-smart-communities',
  'economic-community-considerations','filed-decision','fire-safety-fact-sheet',
  'legal-moratorium-criteria-summary','passivhaus-mixed-use-multifamily',
  'stormwater-resiliency-financing','westchester-bess-fact-sheet'];
for (const a of anchors) {
  check(runScript('resources.html', `${OLD}/resources.html#${a}`),
        `${NEW}/resources.html#${a}`, `PDF anchor #${a}`);
}
check(runScript('index.html', `${OLD}/index.html`), `${NEW}/index.html`, 'PDF link index.html');
check(runScript('resources.html', `${OLD}/resources.html`), `${NEW}/resources.html`, 'PDF link resources.html');

check(runScript('index.html', `${OLD}/index.html?town=bedford#projects`),
      `${NEW}/index.html?town=bedford#projects`, 'query + anchor preserved');
check(runScript('considerations.html', `${OLD}/considerations.html`),
      `${NEW}/considerations.html`, 'considerations chains to its own stub');

check(runScript('404.html', `${OLD}/`), `${NEW}/`, 'catch-all bare root');
check(runScript('404.html', `${OLD}`), `${NEW}/`, 'catch-all no trailing slash');
check(runScript('404.html', `${OLD}/docs/fire-safety-fact-sheet.pdf`),
      `${NEW}/docs/fire-safety-fact-sheet.pdf`, 'catch-all PDF asset');
check(runScript('404.html', `${OLD}/preview/resources.html#filed-decision`),
      `${NEW}/preview/resources.html#filed-decision`, 'catch-all nested + anchor');
check(runScript('404.html', `${OLD}/feedback.html?town=ossining`),
      `${NEW}/feedback.html?town=ossining`, 'catch-all unknown page + query');
check(runScript('404.html', `${OLD}/bess_data.json`), `${NEW}/bess_data.json`, 'catch-all data file');

console.log(fail ? `\n${fail} FAILED` : '\nAll redirect assertions passed.');
process.exit(fail ? 1 : 0);
