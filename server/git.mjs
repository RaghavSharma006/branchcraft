import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, realpath, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AsyncLocalStorage } from 'node:async_hooks';
const environment = new AsyncLocalStorage();
export const withGitEnvironment = (values, fn) => environment.run(values, fn);
const exec = promisify(execFile);
export async function git(repo, args, extra = {}) {
  try {
    const { stdout } = await exec('git', ['-c', 'color.ui=false', ...args], {
      cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 90000,
      windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true', ...environment.getStore(), ...extra },
    });
    return stdout;
  } catch (error) { throw new Error((error.stderr || error.stdout || error.message).trim()); }
}
export async function openRepository(input) {
  if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('Choose an absolute folder path.');
  const folder = await realpath(input);
  const root = (await git(folder, ['rev-parse', '--show-toplevel'])).trim();
  return realpath(root);
}
async function optional(repo, args) { try { return await git(repo, args); } catch { return ''; } }
const exists = async p => { try { await access(p); return true; } catch { return false; } };
export async function state(repo) {
  const [log, status, branches, head, current, remote, gitdir, ahead] = await Promise.all([
    optional(repo, ['log', '--all', 'HEAD', '-n', '180', '--topo-order', '--format=%H%x1f%P%x1f%D%x1f%an%x1f%aI%x1f%s%x1e']),
    git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(repo, ['for-each-ref', '--format=%(refname)%09%(objectname)%09%(upstream:short)%09%(symref)', 'refs/heads', 'refs/remotes']),
    optional(repo, ['rev-parse', '--verify', 'HEAD']), optional(repo, ['symbolic-ref', '--short', '-q', 'HEAD']),
    optional(repo, ['remote', 'get-url', 'origin']), git(repo, ['rev-parse', '--absolute-git-dir']),
    optional(repo, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']),
  ]);
  const files = []; const parts = status.split('\0');
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const code = parts[i].slice(0, 2), file = parts[i].slice(3);
    const original = /[RC]/.test(code) ? parts[++i] : undefined;
    files.push({ path: file, code, original, conflict: ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(code) });
  }
  const gd = gitdir.trim(); let operation = null;
  if (await exists(path.join(gd, 'rebase-merge')) || await exists(path.join(gd, 'rebase-apply'))) operation = 'rebase';
  else if (await exists(path.join(gd, 'MERGE_HEAD'))) operation = 'merge';
  else if (await exists(path.join(gd, 'CHERRY_PICK_HEAD'))) operation = 'cherry-pick';
  else if (await exists(path.join(gd, 'REVERT_HEAD'))) operation = 'revert';
  else if (await exists(path.join(gd, 'BISECT_LOG'))) operation = 'bisect';
  const counts = ahead.trim().split(/\s+/).map(Number);
  return {
    name: path.basename(repo), path: repo, head: head.trim(), current: current.trim() || 'Detached HEAD',
    commits: log.split('\x1e').map(s => s.trim()).filter(Boolean).map(s => { const [hash, parents, refs, author, date, subject] = s.split('\x1f'); return { hash, parents: parents.split(' ').filter(Boolean), refs, author, date, subject }; }),
    files, branches: branches.trim().split('\n').filter(Boolean).map(s => { const [ref, hash, upstream, symbolic] = s.trimEnd().split('\t'); return { name: ref.replace(/^refs\/(heads|remotes)\//, ''), hash, upstream, remote: ref.startsWith('refs/remotes/'), symbolic }; }).filter(b => !b.symbolic),
    remote: remote.trim().replace(/(https?:\/\/)[^/@]+@/, '$1'), ahead: counts[0] || 0, behind: counts[1] || 0, operation,
    stashes: (await optional(repo, ['stash', 'list', '--format=%gd%x09%s'])).trim().split('\n').filter(Boolean).map(s => { const [ref, ...message] = s.split('\t'); return { ref, message: message.join('\t') }; }),
  };
}
export function validPath(file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file) || file.includes('\0') || file.split(/[\\/]/).some(p => p === '..' || p.toLowerCase() === '.git')) throw new Error('Invalid repository file path.');
  return file;
}
async function revision(repo, value) {
  if (typeof value !== 'string' || !value || value.startsWith('-') || /[\0\r\n]/.test(value)) throw new Error('Choose a valid commit or branch.');
  return (await git(repo, ['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`])).trim();
}
async function branchName(repo, name) {
  if (typeof name !== 'string' || name.startsWith('-') || /[\0\r\n]/.test(name)) throw new Error('Invalid branch name.');
  await git(repo, ['check-ref-format', '--branch', name]); return name;
}
export async function diff(repo, input) {
  if (input.hash) { const hash = await revision(repo, input.hash); return git(repo, ['show', '--format=fuller', '--stat', '--patch', '--no-ext-diff', '--no-textconv', hash, '--']); }
  if (input.file) {
    const file = validPath(input.file), s = await state(repo), f = s.files.find(x => x.path === file);
    if (!f) return 'No uncommitted changes in this file.';
    if (f.code === '??') {
      const { readFile, lstat } = await import('node:fs/promises');
      const target = path.resolve(repo, file); const stat = await lstat(target);
      if (stat.isSymbolicLink()) return 'Untracked symbolic link. Contents are not followed.';
      const resolved = await realpath(target);
      if (!resolved.startsWith(repo + path.sep)) throw new Error('File is outside the repository.');
      if (stat.size > 256000) return 'File is too large to preview (250 KB limit).';
      const data = await readFile(resolved); if (data.includes(0)) return 'Binary file. No text preview.';
      return `New file: ${file}\n\n${data.toString('utf8')}`;
    }
    return git(repo, ['diff', '--no-ext-diff', '--no-textconv', ...(s.head ? ['HEAD'] : ['--cached']), '--', file]);
  }
  return '';
}
export async function recovery(repo) {
  const text = await optional(repo, ['reflog', '-n', '60', '--format=%H%x09%gd%x09%gs']);
  return text.trim().split('\n').filter(Boolean).map(s => { const [hash, ref, message] = s.split('\t'); return { hash, ref, message }; });
}
export async function commitDetails(repo, input) {
  const hash = await revision(repo, input.hash);
  const [metadata, stats, refs] = await Promise.all([
    git(repo, ['show', '-s', '--format=%H%x00%an%x00%ae%x00%aI%x00%cn%x00%cI%x00%P%x00%B', hash]),
    git(repo, ['show', '--format=', '--numstat', '-z', '--no-renames', '--first-parent', hash, '--']),
    git(repo, ['for-each-ref', '--points-at', hash, '--format=%(refname)', 'refs/heads', 'refs/remotes', 'refs/tags']),
  ]);
  const [, author, email, date, committer, committedDate, parents, message] = metadata.split('\0');
  const files = stats.split('\0').filter(Boolean).map(row => { const [added, removed, ...file] = row.split('\t'); return { path: file.join('\t'), added: added === '-' ? null : Number(added), removed: removed === '-' ? null : Number(removed) }; });
  return { hash, author, email, date, committer, committedDate, parents: parents.split(' ').filter(Boolean), message: message.trimEnd(), refs: refs.trim().split('\n').filter(Boolean), files, additions: files.reduce((n, f) => n + (f.added || 0), 0), deletions: files.reduce((n, f) => n + (f.removed || 0), 0) };
}
export async function runAction(repo, input) {
  const before = await state(repo);
  if (typeof input.expectedHead !== 'string' || input.expectedHead !== before.head) throw new Error('The repository changed. Refresh the graph and try again.');
  const cleanActions = ['switch', 'merge', 'rebase', 'cherry-pick', 'revert', 'squash', 'pull', 'bisect'];
  if (cleanActions.includes(input.action) && before.files.length) throw new Error('Save a checkpoint or put your changes on the shelf before this action.');
  if (before.operation && !['continue', 'abort', 'resolve', 'bisect-good', 'bisect-bad', 'bisect-reset'].includes(input.action)) throw new Error(`Finish or cancel the ${before.operation} already in progress.`);
  let args; let output = ''; let temp;
  switch (input.action) {
    case 'commit': {
      if (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 4000) throw new Error('Add a checkpoint message.');
      if (!Array.isArray(input.files) || !input.files.length) throw new Error('Select at least one changed file.');
      const files = [...new Set(input.files.flatMap(f => { validPath(f); const item = before.files.find(x => x.path === f); if (!item || item.conflict) throw new Error('Refresh or resolve conflicts before saving.'); return item.original ? [f, validPath(item.original)] : [f]; }))];
      await git(repo, ['add', '--', ...files]);
      args = ['commit', '--only', '-m', input.message.trim(), '--', ...files]; break;
    }
    case 'branch': args = ['switch', '-c', await branchName(repo, input.name), ...(before.head ? [await revision(repo, input.target || before.head)] : [])]; break;
    case 'switch': {
      if (!before.branches.some(b => !b.remote && b.name === input.target)) throw new Error('Select a local branch. Use Start branch to work from a commit.');
      args = ['switch', input.target]; break;
    }
    case 'merge': args = ['merge', '--no-edit', await revision(repo, input.target)]; break;
    case 'rebase': args = ['rebase', await revision(repo, input.target)]; break;
    case 'cherry-pick': args = ['cherry-pick', await revision(repo, input.target)]; break;
    case 'revert': args = ['revert', '--no-edit', await revision(repo, input.target)]; break;
    case 'stash': args = ['stash', 'push', '--include-untracked', '-m', String(input.message || 'Saved from Branchcraft').slice(0, 300)]; break;
    case 'stash-apply': if (!before.stashes.some(s => s.ref === input.target)) throw new Error('That shelf item no longer exists.'); args = ['stash', 'apply', input.target]; break;
    case 'fetch': args = ['fetch', '--prune', 'origin']; break;
    case 'pull': args = ['pull', '--ff-only']; break;
    case 'push': if (before.current === 'Detached HEAD') throw new Error('Create a branch before publishing.'); args = ['push', '--set-upstream', 'origin', before.current]; break;
    case 'resolve': {
      const file = validPath(input.file);
      if (!before.files.some(f => f.path === file && f.conflict)) throw new Error('This file has no unresolved conflict.');
      if (!['ours', 'theirs', 'edited'].includes(input.choice)) throw new Error('Choose a resolution.');
      if (input.choice !== 'edited') await git(repo, ['checkout', `--${input.choice}`, '--', file]);
      args = ['add', '--', file]; break;
    }
    case 'continue': if (!before.operation || before.operation === 'bisect') throw new Error('No operation to continue.'); args = [before.operation, '--continue']; break;
    case 'abort': if (!before.operation || before.operation === 'bisect') throw new Error('No operation to cancel.'); args = [before.operation, '--abort']; break;
    case 'bisect': args = ['bisect', 'start', await revision(repo, input.bad), await revision(repo, input.good)]; break;
    case 'bisect-good': case 'bisect-bad': case 'bisect-reset': if (before.operation !== 'bisect') throw new Error('Start Find the bug first.'); args = ['bisect', input.action.slice(7)]; break;
    case 'tag': args = ['tag', await branchName(repo, input.name), await revision(repo, input.target || before.head)]; break;
    case 'squash': {
      const n = Number(input.count);
      if (!Number.isInteger(n) || n < 2 || n > 20) throw new Error('Choose 2–20 recent checkpoints.');
      if (before.current === 'Detached HEAD') throw new Error('Switch to a branch before combining checkpoints.');
      if (!String(input.message || '').trim()) throw new Error('Add a combined checkpoint message.');
      const base = await revision(repo, `HEAD~${n}`);
      if ((await git(repo, ['rev-list', '--merges', `${base}..HEAD`])).trim()) throw new Error('This range contains a merge. Combine a linear series of commits instead.');
      const hashes = (await git(repo, ['rev-list', '--reverse', `${base}..HEAD`])).trim().split('\n');
      const remoteRefs = (await git(repo, ['for-each-ref', '--contains', hashes[0], '--format=%(refname)', 'refs/remotes'])).trim();
      if (remoteRefs) throw new Error('These commits are on a known remote branch. Combine unpublished checkpoints instead.');
      temp = await mkdtemp(path.join(os.tmpdir(), 'branchcraft-'));
      const script = path.join(temp, 'sequence.cjs');
      await writeFile(script, `require('fs').writeFileSync(process.argv[2], ${JSON.stringify(hashes.map((h, i) => `${i ? 'fixup' : 'pick'} ${h}`).join('\n') + '\n')});`);
      const backup = `branchcraft-backup/${Date.now()}`;
      await git(repo, ['branch', backup, before.head]);
      try {
        output = await git(repo, ['rebase', '-i', base], { GIT_SEQUENCE_EDITOR: `"${process.execPath.replaceAll('\\', '/')}" "${script.replaceAll('\\', '/')}"` });
        output += await git(repo, ['commit', '--amend', '-m', String(input.message).slice(0, 4000)]);
        output += `\nOriginal history is saved on ${backup}.`;
      } catch (error) { output = `${error.message}\nOriginal history is saved on ${backup}.`; }
      finally { await rm(temp, { recursive: true, force: true }); }
      return { output, state: await state(repo) };
    }
    default: throw new Error('Unsupported action.');
  }
  try { output = await git(repo, args); }
  catch (error) {
    const after = await state(repo);
    if (after.operation || after.files.some(f => f.conflict)) return { output: error.message, needsAttention: true, state: after };
    throw error;
  }
  return { output: output || 'Done.', state: await state(repo) };
}
