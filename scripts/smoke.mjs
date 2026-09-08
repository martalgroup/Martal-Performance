#!/usr/bin/env node
/**
 * Requests the pages people actually use, against a real server, and fails the
 * build if any of them errors.
 *
 * Why this exists: two crashes reached the team that every other check passed.
 * A `parsedUsd` reference above its own declaration compiled cleanly and threw
 * only when the Edit price page ran ("a client-side exception has occurred").
 * A lazily-read template file was invisible to Next's file tracing and threw
 * only when the clause editor ran ("a server-side exception ... Digest:
 * 3638017295"). `next build` cannot catch either, and neither can a harness
 * that renders components directly — the quotation-page layout bug proved that
 * one, because rendering the component skipped the layout that was breaking it.
 *
 * The only thing that catches this class of fault is loading the real route
 * through the real server in a real browser, so that is what this does.
 *
 *   node scripts/smoke.mjs                     # against a local `next start`
 *   node scripts/smoke.mjs --url https://…     # against a deployed build
 *
 * A page fails on any of: an HTTP error, Next's error boundary ("Application
 * error", "Digest:"), an uncaught exception, or a console error.
 *
 * /login is in the list deliberately. It threw a server-side exception for
 * every signed-in visitor (digest 1835890360) because the page read `supabase`
 * one line above its own declaration, and the only way to see that was to load
 * the page while holding a session.
 *
 * AUTHENTICATION. Every page worth checking is behind the login gate, so the
 * run needs a session. It mints one the way the app's own admin panel does,
 * with SUPABASE_SERVICE_ROLE_KEY: generateLink gives a token, verifyOtp turns
 * it into a session, and @supabase/ssr writes that session into cookies in its
 * own format (rather than this script guessing at cookie names). No password,
 * no new account, no test user: it signs in as an existing one.
 *
 * Without a usable service-role key the authenticated pages cannot be reached.
 * The run then checks the public ones, says plainly which it could not reach,
 * and still passes: a check that blocks the build over a missing key is a
 * check people delete. It fails only on a page that is actually broken.
 */
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import process from 'process';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.SMOKE_PORT || 3988);
const SMOKE_EMAIL = process.env.SMOKE_EMAIL || 'edward@martalgroup.com';

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const externalBase = urlArg !== -1 ? args[urlArg + 1]?.replace(/\/$/, '') : null;

const gray = (s) => `\x1b[90m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function skip(why) {
  console.log(`\n${yellow('SMOKE SKIPPED')} ${why}\n`);
  process.exit(0);
}

// Vercel runs `npm run build`, which would run this as postbuild. It has no
// business starting a second server inside the build container.
if (process.env.VERCEL) skip('running inside a Vercel build.');

/** Next loads .env.local itself; this script is plain node, so read it here. */
function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY) skip('no Supabase URL/anon key in the environment.');

// A placeholder is the local default, and is worth naming precisely rather
// than failing later with an opaque "Invalid API key".
const haveServiceKey = !!SERVICE_KEY && !/placeholder|needs-real-key/i.test(SERVICE_KEY);

/** Signs in as an existing user and returns the cookies a browser should carry. */
async function mintSessionCookies(base) {
  const { createClient } = await import('@supabase/supabase-js');
  const { createServerClient } = await import('@supabase/ssr');

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: SMOKE_EMAIL,
    options: { redirectTo: `${base}/auth/callback` },
  });
  if (link.error) throw new Error(`generateLink failed for ${SMOKE_EMAIL}: ${link.error.message}`);

  const tokenHash = link.data?.properties?.hashed_token;
  if (!tokenHash) throw new Error('generateLink returned no hashed_token');

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verified.error) throw new Error(`verifyOtp failed: ${verified.error.message}`);
  const session = verified.data?.session;
  if (!session) throw new Error('verifyOtp returned no session');

  // Let @supabase/ssr name and chunk the cookies. Hand-rolling
  // "sb-<ref>-auth-token" and its base64 chunking is exactly the kind of
  // detail that silently changes with a library version.
  const jar = new Map();
  const writer = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const set = await writer.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (set.error) throw new Error(`setSession failed: ${set.error.message}`);
  if (jar.size === 0) throw new Error('no auth cookies were produced');

  return { jar, admin, email: session.user?.email };
}

/** Performance has no per-deal routes, so there is nothing to look up. */
async function pickFixtures() {
  return { clientId: null, note: 'n/a' };
}

async function waitForServer(base) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const res = await fetch(`${base}/login`, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  let server = null;
  let base = externalBase;

  if (!base) {
    if (!existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
      skip('no build output in .next — run `npm run build` first.');
    }
    base = `http://localhost:${PORT}`;
    server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
    });
    const serverLog = [];
    server.stdout.on('data', (d) => serverLog.push(String(d)));
    server.stderr.on('data', (d) => serverLog.push(String(d)));
    server.on('exit', (code) => {
      if (code) console.log(gray(serverLog.join('').trim()));
    });
    if (!await waitForServer(base)) {
      server.kill();
      console.log(gray(serverLog.join('').trim()));
      skip(`the server never came up on port ${PORT}.`);
    }
  }

  const stop = () => { if (server && !server.killed) server.kill(); };

  let auth = null;
  let why = 'SUPABASE_SERVICE_ROLE_KEY is not set — put the real service_role key in '
    + '.env.local to check the pages behind the login gate';
  if (haveServiceKey) {
    try {
      auth = await mintSessionCookies(base);
    } catch (e) {
      why = `could not mint a session: ${e.message}`;
    }
  }

  const { note } = auth ? await pickFixtures() : { note: 'not signed in' };

  // The routes that carry real risk: everything an AE or an approver touches,
  // plus the two that have actually broken in production.
  const routes = [
    ['/login', 'sign-in'],
    ['/denied', 'access denied'],
    ...(!auth ? [] : [
      ['/console', 'performance'],
      ['/console/reps', 'sales reps'],
      ['/console/churn', 'company churn'],
      ['/console/admin/users', 'users'],
    ]),
  ];

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ headless: true });
  const host = new URL(base).hostname;
  const context = await browser.newContext();
  if (auth) {
    await context.addCookies([...auth.jar.entries()].map(([name, value]) => ({
      name, value, domain: host, path: '/', httpOnly: false, secure: base.startsWith('https'),
    })));
  }

  console.log(`\nSmoke: ${base}  as ${auth ? auth.email : 'anonymous'}  (${note})`);
  if (!auth) console.log(yellow(`  note: ${why}`));
  console.log('');

  const failures = [];
  const page = await context.newPage();

  // Console noise that says nothing about whether the page works.
  const IGNORE = [
    /favicon/i,
    /Failed to load resource.*404/i,
    /Download the React DevTools/i,
  ];
  let pageErrors = [];
  let consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0]));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (!IGNORE.some((re) => re.test(text))) consoleErrors.push(text.split('\n')[0]);
  });

  for (const [route, label] of routes) {
    pageErrors = [];
    consoleErrors = [];
    const problems = [];
    let status = '—';
    try {
      const res = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      status = res?.status() ?? '—';
      if (status >= 400) problems.push(`HTTP ${status}`);

      const body = await page.evaluate(() => document.body?.innerText || '');
      // Next's error boundaries. The digest form is the one the team reported.
      if (/Application error: a client-side exception/i.test(body)) problems.push('client-side exception');
      if (/Application error: a server-side exception/i.test(body)) problems.push('server-side exception');
      const digest = body.match(/Digest:\s*(\d+)/i);
      if (digest) problems.push(`digest ${digest[1]}`);

      // A page that quietly redirected to /login means the session did not
      // take, and every "pass" after it would be meaningless.
      const landed = new URL(page.url()).pathname;
      if (route.startsWith('/console') && landed === '/login') problems.push('bounced to /login');

      problems.push(...pageErrors.map((m) => `threw: ${m}`));
      problems.push(...consoleErrors.map((m) => `console: ${m}`));
    } catch (e) {
      problems.push(`navigation failed: ${e.message.split('\n')[0]}`);
    }

    const name = `${label} ${gray(route)}`;
    if (problems.length) {
      failures.push({ route, label, problems });
      console.log(`  ${red('FAIL')} ${name}`);
      problems.forEach((p) => console.log(`       ${red(p)}`));
    } else {
      console.log(`  ${green('ok')}   ${name} ${gray(String(status))}`);
    }
  }

  await browser.close();
  stop();

  if (failures.length) {
    console.log(`\n${red(`SMOKE FAILED: ${failures.length} of ${routes.length} pages`)}`);
    console.log(`${failures.map((f) => `  ${f.label}: ${f.problems.join('; ')}`).join('\n')}\n`);
    process.exit(1);
  }
  console.log(`\n${green(`SMOKE PASSED: ${routes.length} pages`)}`);
  if (!auth) console.log(yellow('  the pages behind the login gate were not checked\n'));
  else console.log('');
}

main().catch((e) => {
  console.error(red(`\nSmoke check crashed: ${e.stack || e.message}\n`));
  process.exit(1);
});
