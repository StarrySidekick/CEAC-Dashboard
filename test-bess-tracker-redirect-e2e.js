/* End-to-end redirect test.

   Run: npm i playwright-core && node test-bess-tracker-redirect-e2e.js
   Env: BESS_TRACKER_DIR (default ./bess-tracker-redirect), CHROME_PATH.

   Chromium cannot reach the network through this session's proxy, so instead of
   skipping the browser check, requests to starrysidekick.github.io are fulfilled
   from the real deployed files on disk, replicating GitHub Pages' behaviour
   (missing path -> that site's 404.html, served with status 404).
     /bess-tracker/*    -> /home/user/bess-tracker        (exactly what is on main)
     /CEAC-Dashboard/*  -> /home/user/CEAC-Dashboard      (identical to main)
   The page still navigates under the real hostname, so the redirect chain, the
   #anchor, and the document viewer are all exercised for real. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ROOTS = { '/bess-tracker': process.env.BESS_TRACKER_DIR || __dirname + '/bess-tracker-redirect', '/CEAC-Dashboard': __dirname };
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.pdf': 'application/pdf',
                '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript' };

function resolve(pathname) {
  for (const [prefix, dir] of Object.entries(ROOTS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      let rel = pathname.slice(prefix.length) || '/';
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(dir, rel);
      if (file.startsWith(dir) && fs.existsSync(file) && fs.statSync(file).isFile())
        return { file, status: 200 };
      const nf = path.join(dir, '404.html');
      return fs.existsSync(nf) ? { file: nf, status: 404 } : { status: 404 };
    }
  }
  return { status: 404 };
}

const OLD = 'https://starrysidekick.github.io/bess-tracker';
const NEW = 'https://starrysidekick.github.io/CEAC-Dashboard';
const anchors = ['ceac-bess-slide-deck','clean-energy-workforce','climate-smart-communities',
  'economic-community-considerations','filed-decision','fire-safety-fact-sheet',
  'legal-moratorium-criteria-summary','passivhaus-mixed-use-multifamily',
  'stormwater-resiliency-financing','westchester-bess-fact-sheet'];

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.route('https://starrysidekick.github.io/**', (route) => {
    const { file, status } = resolve(new URL(route.request().url()).pathname);
    if (!file) return route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>404</h1>' });
    route.fulfill({ status, contentType: TYPES[path.extname(file)] || 'application/octet-stream',
                    body: fs.readFileSync(file) });
  });

  let fail = 0;
  const t = async (from, want, extra) => {
    await page.goto(from, { waitUntil: 'load' });
    await page.waitForURL(u => u.href.startsWith(NEW), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    const got = page.url();
    const note = extra ? await extra(page).catch(e => 'ERR ' + e.message) : '';
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${from.replace(OLD, '')}\n      -> ${got}` +
      (ok ? '' : `\n      want ${want}`) + (note ? `\n      ${note}` : ''));
  };

  // The ten deep anchors baked into the already-distributed PDF. Assert the viewer
  // actually opened the right document, not merely that the URL survived.
  for (const a of anchors) {
    await t(`${OLD}/resources.html#${a}`, `${NEW}/resources.html#${a}`, async (p) => {
      const open = await p.locator('#viewer').isVisible().catch(() => false);
      const title = (await p.locator('#vtitle').innerText().catch(() => '')).trim();
      return `viewer ${open ? 'OPEN' : 'CLOSED'} — "${title}"`;
    });
  }
  await t(`${OLD}/index.html`, `${NEW}/index.html`);
  await t(`${OLD}/resources.html`, `${NEW}/resources.html`);
  await t(`${OLD}/fire-safety.html`, `${NEW}/fire-safety.html`);
  await t(`${OLD}/economics.html`, `${NEW}/economics.html`);
  // considerations.html chains: old stub -> new stub -> index.html#considerations
  await t(`${OLD}/considerations.html`, `${NEW}/index.html#considerations`);
  // Catch-all (served as 404.html by Pages, redirected client-side)
  await t(`${OLD}/`, `${NEW}/index.html`);  // Pages serves the index.html stub here
  await t(`${OLD}/feedback.html?town=ossining`, `${NEW}/feedback.html?town=ossining`);
  await t(`${OLD}/docs/fire-safety-fact-sheet.pdf`, `${NEW}/docs/fire-safety-fact-sheet.pdf`);
  await t(`${OLD}/preview/resources.html#filed-decision`, `${NEW}/preview/resources.html#filed-decision`);

  await browser.close();
  console.log(fail ? `\n${fail} FAILED` : '\nAll end-to-end checks passed.');
  process.exit(fail ? 1 : 0);
})();
