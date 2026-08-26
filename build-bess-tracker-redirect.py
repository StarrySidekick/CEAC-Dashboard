#!/usr/bin/env python3
"""Generate the static redirect site for the old `bess-tracker` GitHub Pages repo.

Background: GitHub permanently redirects a renamed repository's web and git URLs,
but it does NOT redirect the repository's Pages site. When bess-tracker was renamed
to CEAC-Dashboard, https://starrysidekick.github.io/bess-tracker/ started returning
404 while https://starrysidekick.github.io/CEAC-Dashboard/ served the live dashboard.

Fix: a separate repo named `bess-tracker` whose Pages site forwards everything to
the new site. Output of this script is the contents of that repo.

Two layers:
  * one stub per known page, so those URLs answer 200 instead of 404;
  * a 404.html catch-all that strips the /bess-tracker prefix and forwards anything
    else (docs/*.pdf, preview/*, future paths).

Both preserve the query string and the #anchor. The anchor matters: the handed-out
PDF (docs/ceac-resource-roundup-summer2026.pdf) links to ten deep anchors such as
resources.html#fire-safety-fact-sheet, and resources.html opens its document viewer
from location.hash. A plain <meta http-equiv="refresh"> cannot carry a fragment, so
the redirect is done in JS with meta-refresh only as the no-JS fallback.
"""
import os, pathlib

OLD_BASE = "/bess-tracker"
NEW_BASE = "/CEAC-Dashboard"
NEW_ORIGIN = "https://starrysidekick.github.io"
OUT = pathlib.Path(__file__).parent / "bess-tracker-redirect"

# Pages that existed on the old site. considerations.html is itself already a stub
# in CEAC-Dashboard (it forwards to index.html#considerations), so this chains
# correctly rather than needing to know about that section here.
PAGES = {
    "index.html":          "BESS Policy Dashboard",
    "resources.html":      "Resource Library",
    "fire-safety.html":    "Fire Safety",
    "economics.html":      "Economics",
    "considerations.html": "Key Considerations",
}

STYLE = """body{margin:0;background:#EDEAEE;color:#1A1818;line-height:1.55;
 font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
 display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{background:#fff;border:1px solid #E2E1E7;border-left:5px solid #BE1E2D;
 padding:26px 28px;max-width:52ch}
h1{font-size:21px;font-weight:900;margin:0 0 10px}
p{margin:0 0 14px;font-size:15px;color:#54565A}
a.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;background:#BE1E2D;
 color:#fff;font-size:12.5px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;
 text-decoration:none}
a.btn:hover{background:#961826}"""


def stub(page: str, label: str) -> str:
    target = f"{NEW_ORIGIN}{NEW_BASE}/{page}"
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moved — {label}</title>
<link rel="canonical" href="{target}">
<!-- No-JS fallback only. It cannot carry the #anchor; the script below can. -->
<meta http-equiv="refresh" content="1; url={target}">
<style>
{STYLE}
</style>
<script>
(function () {{
  location.replace({target!r} + location.search + location.hash);
}})();
</script>
</head><body>
<div class="card">
  <h1>This site has moved</h1>
  <p>The BESS Policy Dashboard now lives at a new address. You should be
     redirected to <strong>{label}</strong> automatically.</p>
  <p><a class="btn" href="{target}">Continue to the dashboard</a></p>
</div>
</body></html>
"""


CATCHALL = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moved — BESS Policy Dashboard</title>
<link rel="canonical" href="{NEW_ORIGIN}{NEW_BASE}/">
<style>
{STYLE}
</style>
<script>
(function () {{
  var OLD_BASE = {OLD_BASE!r}, NEW_BASE = {NEW_BASE!r};
  var path = location.pathname;
  if (path.indexOf(OLD_BASE) === 0) path = path.slice(OLD_BASE.length);
  if (path.charAt(0) !== "/") path = "/" + path;
  location.replace(location.origin + NEW_BASE + path + location.search + location.hash);
}})();
</script>
</head><body>
<div class="card">
  <h1>This site has moved</h1>
  <p>The BESS Policy Dashboard now lives at a new address. You should be
     redirected automatically.</p>
  <p><a class="btn" href="{NEW_ORIGIN}{NEW_BASE}/">Continue to the dashboard</a></p>
</div>
</body></html>
"""

README = f"""# bess-tracker — redirects only

This repository holds no content. It exists so the old GitHub Pages URLs under
`{NEW_ORIGIN}{OLD_BASE}/` keep working.

The dashboard itself lives in
[StarrySidekick/CEAC-Dashboard](https://github.com/StarrySidekick/CEAC-Dashboard)
and is served at {NEW_ORIGIN}{NEW_BASE}/

## Why this is needed

When a repository is renamed, GitHub permanently redirects its web and git URLs
but **not** its Pages site. Renaming `bess-tracker` to `CEAC-Dashboard` therefore
broke every already-distributed `{OLD_BASE}` link while leaving
`github.com/StarrySidekick/bess-tracker` redirecting fine. Recreating the repo
under the old name and pointing Pages at it is the only way to serve that host path.

## How it works

* One stub per page that existed on the old site, so those URLs answer 200.
* `404.html` catches everything else, strips the `{OLD_BASE}` prefix and forwards
  the remaining path.

Both preserve the query string and the `#anchor`. The anchor is not incidental:
`docs/ceac-resource-roundup-summer2026.pdf`, which has already been handed out,
links to ten deep anchors like `resources.html#fire-safety-fact-sheet`, and
`resources.html` opens its document viewer from `location.hash`. A plain
`<meta http-equiv="refresh">` drops fragments, so the redirect runs in JavaScript
with meta-refresh kept only as the no-JS fallback.

## Regenerating

These files are generated by `build-bess-tracker-redirect.py` in the
CEAC-Dashboard repo. Edit the script, not the HTML.

## Settings

GitHub Pages must be set to **Deploy from a branch → `main` / `(root)`**.
"""


def main():
    OUT.mkdir(exist_ok=True)
    for page, label in PAGES.items():
        (OUT / page).write_text(stub(page, label))
    (OUT / "404.html").write_text(CATCHALL)
    (OUT / ".nojekyll").write_text("")
    (OUT / "README.md").write_text(README)
    for f in sorted(os.listdir(OUT)):
        print("  wrote", f)


if __name__ == "__main__":
    main()
