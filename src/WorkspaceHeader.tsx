import { GitBranch, Github, FolderOpen, CircleHelp } from 'lucide-react';

type Props = {
  mode: 'local' | 'online';
  local: boolean;
  onLocal: () => void;
  onOnline: () => void;
  onHelp: () => void;
  onPractice?: () => void;
};

export function WorkspaceHeader({ mode, local, onLocal, onOnline, onHelp, onPractice }: Props) {
  return <>
    <header className="online-header">
      <div className="online-brand"><GitBranch size={24}/><strong>branchcraft</strong><span>{mode.toUpperCase()}</span></div>
      <div><span className="online-live"><span/>{mode === 'local' ? 'Your files · real Git' : 'Live GitHub data'}</span>
        {!local && onPractice && <button className="quiet" onClick={onPractice}>Try playground</button>}
        <button className="outline" onClick={onHelp}><CircleHelp size={15}/>Help & setup</button>
      </div>
    </header>
    <nav className="source-tabs" aria-label="Repository source">
      <button aria-current={mode === 'local' ? 'page' : undefined} className={mode === 'local' ? 'active' : ''} onClick={onLocal}><FolderOpen size={15}/>Local files</button>
      <button aria-current={mode === 'online' ? 'page' : undefined} className={mode === 'online' ? 'active' : ''} onClick={onOnline}><Github size={15}/>GitHub online</button>
      <span>{mode === 'local' ? 'Works offline · sync when connected' : 'No clone required'}</span>
    </nav>
  </>;
}

export function WorkspaceNav({view, changes, onView}: {view:string; changes:number; onView:(view:string)=>void}) {
  return <nav className="workspace-nav" aria-label="Local workspace">
    {[['graph','History'],['changes',`Changes (${changes})`],['shelf','Shelves'],['recovery','Recovery'],['github','GitHub & PRs']].map(([id,label]) =>
      <button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={()=>onView(id)}>{label}</button>)}
  </nav>;
}
