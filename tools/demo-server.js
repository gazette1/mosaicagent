/**
 * Demo server: drop deal documents in a browser, watch the pipeline run,
 * download the workbook. Zero dependencies; drives the real CLI.
 *
 * Usage: node tools/demo-server.js   (http://localhost:8787)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const CLI = path.join(REPO, 'dist', 'cli', 'index.js');
const UI = path.join(__dirname, 'demo-ui.html');
const PORT = Number(process.env.PORT || 8787);
// Public deployments MUST set DEMO_PASSCODE; without it anyone can spend the
// OpenAI key. Locally (no passcode set) everything is open.
const PASSCODE = process.env.DEMO_PASSCODE || null;

function authorized(req) {
  if (!PASSCODE) return true;
  const url = new URL(req.url, 'http://x');
  return req.headers['x-demo-key'] === PASSCODE || url.searchParams.get('key') === PASSCODE;
}

function kindFor(filename) {
  const ext = path.extname(filename).toLowerCase();
  const base = filename.toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.xlsx' || ext === '.xls') return 'xlsx_model';
  if (ext === '.csv') return base.includes('rent') ? 'rentroll_csv' : 't12_csv';
  if (ext === '.eml') return 'email';
  if (ext === '.md' || ext === '.txt') return 'om_text';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  return null;
}

function run(args) {
  return execFileSync('node', [CLI, ...args], { cwd: REPO, encoding: 'utf-8', timeout: 300000 });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  // CORS: the intake UI is also served from russh.work (static portfolio);
  // the passcode, not the origin, is the gate
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-demo-key');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(UI));
    return;
  }

  if (req.url.startsWith('/api/') && !authorized(req)) {
    return json(res, 401, { error: 'passcode required (x-demo-key header)' });
  }

  if (req.method === 'GET' && req.url.startsWith('/api/workbook/')) {
    const dealId = req.url.split('/').pop().replace(/[^a-z0-9-]/g, '');
    const p = path.join(REPO, 'deals', dealId, 'outputs', 'package.xlsx');
    if (!fs.existsSync(p)) return json(res, 404, { error: 'not found' });
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${dealId}-package.xlsx"`,
    });
    res.end(fs.readFileSync(p));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/api/narrative/')) {
    const dealId = req.url.split('/').pop().replace(/[^a-z0-9-]/g, '');
    const p = path.join(REPO, 'deals', dealId, 'outputs', 'narrative.md');
    if (!fs.existsSync(p)) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    res.end(fs.readFileSync(p));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/deal') {
    let body = '';
    req.setEncoding('utf-8');
    req.on('data', d => {
      body += d;
      if (body.length > 200 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const { name, type, location, narrative, files } = JSON.parse(body);
        if (!name || !type || !Array.isArray(files) || files.length === 0) {
          return json(res, 400, { error: 'name, type, and files required' });
        }
        const steps = [];

        const out = run(['new', '--name', String(name).substring(0, 80), '--type', type, '--location', String(location || 'unknown').substring(0, 80)]);
        const dealId = (out.match(/Created deal: (\S+)/) || [])[1];
        steps.push({ step: 'create', ok: true, detail: dealId });

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-demo-'));
        for (const f of files.slice(0, 8)) {
          const kind = kindFor(f.name || '');
          if (!kind) {
            steps.push({ step: `ingest ${f.name}`, ok: false, detail: 'unsupported type (docx pending)' });
            continue;
          }
          const safe = path.join(tmp, path.basename(f.name).replace(/[^\w.\- ]/g, '_'));
          fs.writeFileSync(safe, Buffer.from(f.b64, 'base64'));
          try {
            const ingestOut = run(['ingest', '--deal', dealId, '--file', safe, '--kind', kind]);
            const fields = (ingestOut.match(/Extracted (\d+)/) || [])[1] ?? '?';
            const llm = ingestOut.includes('LLM added') ? ' + LLM pass' : '';
            steps.push({ step: `ingest ${f.name}`, ok: true, detail: `[${kind}] ${fields} fields${llm}` });
          } catch (e) {
            steps.push({ step: `ingest ${f.name}`, ok: false, detail: (e.message || '').substring(0, 120) });
          }
        }

        try { run(['screen', '--deal', dealId]); steps.push({ step: 'screen', ok: true }); }
        catch (e) { steps.push({ step: 'screen', ok: false, detail: (e.message || '').substring(0, 120) }); }

        try { run(['workbook', '--deal', dealId]); steps.push({ step: 'workbook', ok: true }); }
        catch (e) { steps.push({ step: 'workbook', ok: false, detail: (e.message || '').substring(0, 120) }); }

        if (narrative) {
          try { run(['narrative', '--deal', dealId]); steps.push({ step: 'narrative draft', ok: true }); }
          catch (e) { steps.push({ step: 'narrative draft', ok: false, detail: (e.message || '').substring(0, 120) }); }
        }

        const deal = JSON.parse(fs.readFileSync(path.join(REPO, 'deals', dealId, 'deal.json'), 'utf-8'));
        const screenPath = path.join(REPO, 'deals', dealId, 'outputs', 'screen.json');
        const screen = fs.existsSync(screenPath) ? JSON.parse(fs.readFileSync(screenPath, 'utf-8')) : null;
        const llmCost = deal.auditLog
          .filter(e => ['LLM_EXTRACTION', 'NARRATIVE_DRAFTED'].includes(e.action))
          .reduce((s, e) => s + (e.details.estCostUsd || 0), 0);

        json(res, 200, {
          dealId,
          steps,
          verdict: screen?.verdict ?? null,
          riskScore: screen?.riskScore ?? null,
          confidence: screen?.confidenceSummary?.overall ?? null,
          killFlags: (screen?.killFlags || []).filter(f => f.triggered).map(f => f.criterion),
          metrics: Object.fromEntries(
            Object.entries(screen?.keyMetrics || {}).map(([k, m]) => [k, { name: m.name, value: m.value?.value, unit: m.value?.unit, confidence: m.value?.confidence }])
          ),
          extracted: (deal.extracted.notes || []).map(n => ({ field: n.field, value: n.extractedValue, confidence: n.confidence })),
          estLlmCostUsd: +llmCost.toFixed(4),
          workbookUrl: `/api/workbook/${dealId}`,
          narrativeUrl: narrative ? `/api/narrative/${dealId}` : null,
        });
      } catch (e) {
        json(res, 500, { error: (e.message || 'failed').substring(0, 300) });
      }
    });
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mosaic demo: http://localhost:${PORT}${PASSCODE ? ' (passcode required)' : ''}`));
