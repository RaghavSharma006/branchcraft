import { GitBranch, FileCode2, ArrowUpRight } from 'lucide-react';
import type { Commit, Repo } from './model';
export type Details = { hash: string; author: string; email: string; date: string; committer: string; committedDate: string; parents: string[]; message: string; refs: string[]; files: { path: string; added: number | null; removed: number | null }[]; additions: number; deletions: number };
export function CommitCard({ commit, repo, details, error, onDiff }: { commit: Commit; repo: Repo; details?: Details; error?: string; onDiff: () => void }) {
 const refs = details?.refs || repo.branches.filter(b => b.hash === commit.hash).map(b => b.name);
 const date = new Date(details?.date || commit.date);
 return <>
  <div className="hover-heading"><code>{commit.hash.slice(0, 7)}</code>{commit.hash === repo.head && <span className="hover-current">HEAD</span>}</div>
  <h3>{commit.subject}</h3>
  <div className="hover-meta"><span>{details?.author || commit.author}</span><time dateTime={date.toISOString()}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
  {refs.length > 0 && <div className="hover-refs">{refs.slice(0, 2).map(ref => <span key={ref} title={ref}><GitBranch size={11}/><span>{ref.replace(/^refs\/(heads|remotes|tags)\//, '')}</span></span>)}{refs.length > 2 && <small>+{refs.length - 2}</small>}</div>}
  <div className="hover-footer">
   {details ? <div className="hover-stats"><FileCode2 size={12}/><span>{details.files.length}</span><span className="added">+{details.additions}</span><span className="removed">−{details.deletions}</span></div> : <span className="hover-status">{error ? 'Preview unavailable' : 'Loading…'}</span>}
   <button className="outline" onClick={onDiff}>View diff<ArrowUpRight size={13}/></button>
  </div>
 </>;
}
