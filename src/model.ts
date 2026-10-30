export type Commit = { hash: string; parents: string[]; refs: string; author: string; date: string; subject: string };
export type UndoEntry = {id:string;label:string;requiresConfirmation:boolean};
export type Repo = { undoRedo?: {undo:UndoEntry|null;redo:UndoEntry|null;reason?:string}; name: string; path: string; head: string; current: string; commits: Commit[]; files: { path: string; code: string; original?: string; conflict: boolean }[]; branches: { name: string; hash: string; upstream?: string; remote: boolean }[]; remote: string; ahead: number; behind: number; operation: string | null; stashes: { ref: string; message: string }[] };
export type Action = { action: string; target?: string; name?: string; message?: string; files?: string[]; file?: string; choice?: string; count?: number; good?: string; bad?: string; historyId?: string; confirmHistory?: boolean };
const hash = (n: number) => n.toString(16).padStart(7, '0') + 'a'.repeat(33);
export function example(): Repo {
 const rows = [
  ['A fresh start', []], ['Set up the app shell', [0]], ['Add the navigation', [1]], ['Build the component library', [2]], ['Explore a new search experience', [3]], ['Polish the settings page', [3]], ['Add keyboard shortcuts', [4]], ['Bring settings together', [5]], ['Make search feel instant', [6]],
 ] as [string, number[]][];
 const commits = rows.map(([subject, parents], i) => ({ hash: hash(i + 100), parents: parents.map(p => hash(p + 100)), refs: '', author: i % 3 === 0 ? 'Alex Morgan' : 'You', date: new Date(Date.UTC(2026, 9, 26, 8, i * 12)).toISOString(), subject })).reverse();
 return { name: 'orbit-workspace', path: 'Interactive practice repository', head: hash(108), current: 'feature/spotlight', commits, files: [{ path: 'src/components/Search.tsx', code: ' M', conflict: false }, { path: 'src/styles/spotlight.css', code: ' M', conflict: false }, { path: 'src/hooks/useShortcut.ts', code: '??', conflict: false }], branches: [{ name: 'main', hash: hash(107), remote: false }, { name: 'feature/spotlight', hash: hash(108), remote: false }, { name: 'origin/main', hash: hash(107), remote: true }], remote: '', ahead: 2, behind: 0, operation: null, stashes: [] };
}
export function demoAction(repo: Repo, action: Action): Repo {
 const r = structuredClone(repo), branch = r.branches.find(b => b.name === r.current);
 const add = (subject: string, parents = [r.head]) => { const c = { hash: crypto.randomUUID().replaceAll('-', '') + 'deadbeef', parents, refs: '', author: 'You', date: new Date().toISOString(), subject }; r.commits.unshift(c); r.head = c.hash; if (branch) branch.hash = c.hash; return c; };
 const target = r.branches.find(b => b.name === action.target)?.hash || action.target || r.head;
 switch (action.action) {
  case 'branch': if (!action.name?.trim() || r.branches.some(b => b.name === action.name)) throw Error('Choose a new branch name.'); r.branches.push({ name: action.name, hash: target, remote: false }); r.current = action.name; r.head = target; break;
  case 'switch': { const b = r.branches.find(b => b.name === action.target); if (!b) throw Error('Choose a branch.'); r.current = b.name; r.head = b.hash; break; }
  case 'commit': if (!action.files?.length || !action.message?.trim()) throw Error('Select files and add a message.'); add(action.message); r.files = r.files.filter(f => !action.files!.includes(f.path)); break;
  case 'merge': if (target === r.head) throw Error('This version is already current.'); add(`Merge ${action.target?.slice(0, 24)}`, [r.head, target]); break;
  case 'rebase': add(`Replay work on ${action.target?.slice(0, 24)}`, [target]); break;
  case 'cherry-pick': add(r.commits.find(c => c.hash === target)?.subject || 'Copy selected change'); break;
  case 'revert': add(`Undo: ${r.commits.find(c => c.hash === target)?.subject || 'selected change'}`); break;
  case 'stash': if (!r.files.length) throw Error('No changes to put aside.'); r.stashes.unshift({ ref: `stash@{${r.stashes.length}}`, message: action.message || 'Work in progress' }); r.files = []; break;
  case 'stash-apply': r.files = example().files; break;
  case 'tag': { const c = r.commits.find(c => c.hash === target); if (c) c.refs = `tag: ${action.name}`; break; }
  default: throw Error('This operation needs a real local repository. Open the setup guide to connect one.');
 }
 return r;
}
export const sampleDiff = `diff --git a/src/components/Search.tsx b/src/components/Search.tsx\n--- a/src/components/Search.tsx\n+++ b/src/components/Search.tsx\n@@ -12,6 +12,9 @@ export function Search() {\n   const [query, setQuery] = useState('');\n+  const results = useMemo(() => search(query), [query]);\n+  useShortcut('mod+k', () => setOpen(true));\n \n-  return <input placeholder="Search" />;\n+  return <SearchDialog results={results} onChange={setQuery} />;\n }`;
