import {randomUUID} from 'node:crypto';

// Session-only history. Backup refs survive a restart, but executable undo entries do not.
const sessions=new Map();
const snapshotKey=Symbol('branchcraftUndoSnapshot');
const supported=new Set(['branch','switch','merge','rebase','cherry-pick','revert']);
const position=s=>({branch:s.current,head:s.head});
const entryView=(entry,direction)=>({id:entry.id,label:entry.label,requiresConfirmation:entry.kind!=='switch',from:position(direction==='undo'?entry.after:entry.before),to:position(direction==='undo'?entry.before:entry.after)});
function session(repo){
  if(!sessions.has(repo)){
    if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
    sessions.set(repo,{undo:[],redo:[],reason:'Undo starts with your next supported action in this session.'});
  }
  return sessions.get(repo);
}
const clean=s=>!s.files.length&&!s.operation&&s.head&&s.current!=='Detached HEAD';
const matches=(a,b)=>a[snapshotKey]===b[snapshotKey];
const unavailable=(reason)=>({undo:null,redo:null,reason});

export function attachHistory(repo,s,refs){
  // Include tags, stash and remote tracking refs; exclude our private recovery refs.
  Object.defineProperty(s,snapshotKey,{value:JSON.stringify([s.head,s.current,refs.trim().split('\n').filter(r=>!r.includes('\trefs/branchcraft/undo/')).sort()])});
  const history=session(repo),undo=history.undo.at(-1),redo=history.redo.at(-1);
  if(s.operation)s.undoRedo=unavailable('Finish or abort the current Git operation first.');
  else if(s.files.length)s.undoRedo=unavailable('Commit or stash your changes before undo or redo.');
  else if((undo&&!matches(s,undo.after))||(redo&&!matches(s,redo.before)))s.undoRedo=unavailable('Repository references changed outside this action history. Start a new action.');
  else s.undoRedo={undo:undo?entryView(undo,'undo'):null,redo:redo?entryView(redo,'redo'):null,reason:undo||redo?undefined:history.reason};
  return s;
}

export function recordAction(repo,input,before,after){
  const history=session(repo),undo=history.undo.at(-1),redo=history.redo.at(-1);
  if((undo&&!matches(before,undo.after))||(redo&&!matches(before,redo.before))){history.undo=[];history.redo=[];}
  if(matches(before,after))return;
  history.redo=[];
  if(!supported.has(input.action)||!clean(before)||!clean(after)){
    history.undo=[];history.reason='This action is not supported by session undo. Use Recovery history for earlier commits.';return;
  }
  // A branch switch may only change HEAD; history edits may only move the active ref.
  const kind=input.action==='branch'?'branch':input.action==='switch'?'switch':'history';
  const label=input.action==='branch'?`Create branch ${input.name}`:input.action==='switch'?`Switch to ${input.target}`:`${input.action[0].toUpperCase()+input.action.slice(1)} ${String(input.target||'').slice(0,40)}`;
  history.undo.push({id:randomUUID(),kind,label,before,after});
  if(history.undo.length>20)history.undo.shift();
}

export function clearHistory(repo,reason='This action is not supported by session undo. Use Recovery history for earlier commits.'){
  const history=session(repo);history.undo=[];history.redo=[];history.reason=reason;
}

export async function navigateHistory(repo,input,before,{git,state}){
  const history=session(repo),direction=input.action,stack=history[direction],entry=stack?.at(-1);
  if(!entry||input.historyId!==entry.id)throw Error('Undo history changed. Refresh before trying again.');
  if(!clean(before))throw Error('Undo and redo require a clean working tree and a local branch.');
  const expected=direction==='undo'?entry.after:entry.before,target=direction==='undo'?entry.before:entry.after;
  if(!matches(before,expected))throw Error('Repository references changed. This undo or redo is no longer safe.');
  if(entry.kind!=='switch'&&input.confirmHistory!==true)throw Error('Confirm this history change before continuing.');
  if(entry.kind==='history'){
    // Detect commits being removed that are reachable through any known remote ref.
    const range=[before.head,`^${target.head}`];
    const total=Number((await git(repo,['rev-list','--count',...range])).trim());
    const unpublished=Number((await git(repo,['rev-list','--count',...range,'--not','--remotes'])).trim());
    if(unpublished<total)throw Error('This would remove commits on a known remote branch. Use Revert instead.');
  }
  if(entry.kind==='branch'&&direction==='undo'){
    const remote=(await git(repo,['for-each-ref','--format=%(refname)','refs/remotes'])).trim().split('\n');
    if(remote.some(ref=>ref.endsWith('/'+entry.after.current)))throw Error('This branch has a known remote copy. Keep it or delete it explicitly.');
  }
  if(entry.kind!=='switch'){
    // Both endpoints remain recoverable even after repeated undo/redo or restart.
    for(const [side,s] of [['before',entry.before],['after',entry.after]])
      await git(repo,['update-ref',`refs/branchcraft/undo/${entry.id}/${side}`,s.head]);
  }
  let output='';
  if(entry.kind==='switch')output=await git(repo,['switch',target.current]);
  else if(entry.kind==='branch'){
    if(direction==='undo'){
      output=await git(repo,['switch',target.current]);
      await git(repo,['update-ref','-d',`refs/heads/${entry.after.current}`,entry.after.head]);
    }else output=await git(repo,['switch','-c',entry.after.current,entry.after.head]);
  }else output=await git(repo,['reset','--keep',target.head]);
  const after=await state(repo);
  if(!matches(after,target)){
    clearHistory(repo,'Repository changed during undo/redo. Refresh and inspect Recovery history.');
    throw Error('Repository changed during undo/redo. Inspect the current state before continuing.');
  }
  stack.pop();history[direction==='undo'?'redo':'undo'].push(entry);
  return {output:output||`${direction==='undo'?'Undid':'Redid'} ${entry.label}.`,state:await state(repo)};
}
