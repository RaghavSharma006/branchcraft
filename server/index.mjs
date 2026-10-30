import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openRepository, state, diff, runAction, recovery, commitDetails, withGitEnvironment } from './git.mjs';
import * as github from './github.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.BRANCHCRAFT_PORT || 4317);
const token = randomBytes(32).toString('hex');
let repo = process.argv[2] ? await openRepository(path.resolve(process.argv[2])) : null;
let busy = false;
const origin = `http://127.0.0.1:${port}`;
function authenticated(req) { const provided = req.headers['x-branchcraft-token']; if(typeof provided!=='string')return false; const value=Buffer.from(provided); const expected=Buffer.from(token); return value.length===expected.length && timingSafeEqual(value,expected); }
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403).end('Local requests only.'); return; }
  const url = new URL(req.url, origin);
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json');
    if (!authenticated(req)) { res.writeHead(401).end(JSON.stringify({ error: 'Open the private launch link printed by the local server.' })); return; }
    if (req.method !== 'POST') { res.writeHead(405).end('{}'); return; }
    let lock = false;
    try {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 128000) throw new Error('Request too large.'); }
      const input = JSON.parse(body || '{}');
      if (['/api/open', '/api/action','/api/github/clone','/api/github/connect','/api/github/create-pull'].includes(url.pathname)) { if (busy) throw new Error('An operation is still running.'); busy = true; lock = true; }
      let result;
      if (url.pathname === '/api/open') { const next = await openRepository(input.path); result = await state(next); repo = next; }
      else if (url.pathname === '/api/session') result = repo ? await state(repo) : null;
      else if (url.pathname === '/api/github/account') result = await github.account();
      else if (url.pathname === '/api/github/online') result = await github.readOnline(input);
      else if (url.pathname === '/api/github/connect') result = await github.connect(input.token);
      else if (url.pathname === '/api/github/repos') result = await github.repositories(input);
      else if (url.pathname === '/api/github/pulls') result = await github.pullRequests(input);
      else if (url.pathname === '/api/github/checks') result = await github.checks(input);
      else if (url.pathname === '/api/github/create-pull') result = await github.createPull(input);
      else if (url.pathname === '/api/github/clone') { const next=await github.cloneRepository(input);result=await state(next);repo=next; }
      else if (!repo) throw new Error('Open a repository first.');
      else if (input.expectedRepo && input.expectedRepo !== repo) throw new Error('The active project changed in another tab. Refresh before continuing.');
      else if (url.pathname === '/api/state') result = await state(repo);
      else if (url.pathname === '/api/commit') result = await commitDetails(repo, input);
      else if (url.pathname === '/api/diff') result = await diff(repo, input);
      else if (url.pathname === '/api/recovery') result = await recovery(repo);
      else if (url.pathname === '/api/action') { if (input.expectedRepo !== repo) throw new Error('Refresh and select the project before changing it.'); result = await withGitEnvironment(github.githubGitEnvironment(), () => runAction(repo, input)); }
      else { res.writeHead(404).end('{}'); return; }
      res.end(JSON.stringify(result));
    } catch (error) { res.writeHead(400).end(JSON.stringify({ error: error.message })); }
    finally { if (lock) busy = false; }
    return;
  }
  try {
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    let content = await readFile(file);
    // Same-origin HTML bootstraps the local session, including after a server restart.
    // Host/Origin checks above and the browser's same-origin policy protect this value.
    if (path.extname(file) === '.html') content = Buffer.from(content.toString().replace('<head>', `<head><meta name="branchcraft-session" content="${token}">`));
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end('Build the interface first: npm run build'); }
});
server.listen(port, '127.0.0.1', async () => {
  const url=`${origin}/?session=${token}`;
  console.log(`Branchcraft is ready. Open this private local link:\n${url}`);
  if(process.env.BRANCHCRAFT_OPEN==='1') (await import('./browser.mjs')).openBrowser(url);
});
