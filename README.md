# Martal Performance Intelligence

`index.html` is the whole dashboard: React 18 + Babel standalone via CDN, all data
inlined. It stays at the repo root because GitHub Pages requires it there.

## Hosting

Live on Vercel at https://martal-performance.vercel.app, behind HTTP Basic Auth.

Anything at the root of a Vercel project is served as a static file, which would
expose `index.html` directly and bypass the auth. So the build writes an empty
output directory: Vercel then serves no static files, every path falls through
to the rewrite in `vercel.json`, and `api/dashboard.js` is the only way in.

The password is the `APP_PASSWORD` environment variable on the Vercel project.
Change it in Vercel and redeploy; there is nothing to change in the code.

## Updating the data

Edit `index.html` and push to `main`. The inline JSX is one
`<script type="text/babel">` block, so a bad insert breaks the whole app
silently. Load it locally and check the console before pushing.
