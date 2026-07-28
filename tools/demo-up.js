/**
 * One-command demo launcher: `npm run demo`
 *
 * Starts the back-office server, opens a Cloudflare quick tunnel, waits for
 * the public URL, verifies the tunnel actually reaches the server, and prints
 * the exact two values to paste into russh.work/back.
 *
 * Exists because quick-tunnel URLs change on every restart, and hunting for
 * the URL in cloudflared's log output mid-demo is how demos die.
 */
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const line = s => console.log(s);

// Passcode from .env (created if absent, so the tunnel is never open)
const envPath = path.join(REPO, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
let pass = (env.match(/^DEMO_PASSCODE=(.*)$/m) || [])[1];
if (!pass) {
  pass = 'mosaic-' + require('crypto').randomBytes(6).toString('hex');
  fs.appendFileSync(envPath, `${env.endsWith('\n') || !env ? '' : '\n'}DEMO_PASSCODE=${pass}\n`);
  line(`Generated a passcode and wrote it to .env`);
}

// Refuse to launch against a stale build
if (!fs.existsSync(path.join(REPO, 'dist', 'cli', 'index.js'))) {
  line('dist/ missing. Run: npm run build');
  process.exit(1);
}

const children = [];
const bye = () => { for (const c of children) { try { c.kill(); } catch { /* noop */ } } };
process.on('SIGINT', () => { line('\nShutting down. The tunnel URL is now dead.'); bye(); process.exit(0); });
process.on('exit', bye);

// 1. Server
const server = spawn('node', [path.join(__dirname, 'demo-server.js')], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
children.push(server);
server.stderr.on('data', d => process.stderr.write('[server] ' + d));

const ping = async () => {
  try { const r = await fetch('http://localhost:8787/back'); return r.ok; } catch { return false; }
};

(async () => {
  for (let i = 0; i < 30 && !(await ping()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await ping())) { line('Server failed to start on 8787 (is another copy already running?)'); process.exit(1); }
  line('Server up on http://localhost:8787/back');

  // 2. Tunnel
  const tunnel = spawn('npx', ['-y', 'cloudflared', 'tunnel', '--url', 'http://localhost:8787'], { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(tunnel);

  let url = null;
  let registered = 0;
  const scan = buf => {
    const txt = String(buf);
    const m = txt.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !url) { url = m[0]; done(); }
    // Never swallow tunnel health: a silent tunnel is undiagnosable mid-demo
    if (/Registered tunnel connection/.test(txt)) { registered++; line(`[tunnel] connection registered (${registered})`); }
    if (/ERR|error=|failed/i.test(txt) && !/DeprecationWarning/.test(txt)) {
      line('[tunnel] ' + txt.trim().split(String.fromCharCode(10)).slice(-1)[0].substring(0, 160));
    }
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);
  tunnel.on('exit', code => line(`[tunnel] cloudflared exited (code ${code}). The public URL is dead; localhost still works.`));

  async function done() {
    // Confirm the tunnel actually reaches the server before announcing it
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try { ok = (await fetch(url + '/back')).ok; } catch { /* still warming */ }
    }
    if (!ok) {
      // Keep probing in the background and announce if it comes up later
      (async () => {
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 5000));
          try { if ((await fetch(url + '/back')).ok) { line(`[tunnel] now reachable: ${url}`); return; } } catch { /* keep trying */ }
        }
        line('[tunnel] still unreachable. Record against http://localhost:8787/back instead.');
      })();
    }
    line('');
    line('='.repeat(64));
    line(ok ? '  DEMO READY' : '  TUNNEL OPENED BUT NOT YET REACHABLE (give it a moment)');
    line('='.repeat(64));
    line('  Open:      https://russh.work/back');
    line('  Backend:   ' + url);
    line('  Passcode:  ' + pass);
    line('');
    line('  Local (no tunnel needed):  http://localhost:8787/back');
    line('  Ctrl+C here kills the tunnel and the demo link.');
    line('='.repeat(64));
  }

  setTimeout(() => { if (!url) line('No tunnel URL after 60s. Check network, or use http://localhost:8787/back locally.'); }, 60000);
})();
