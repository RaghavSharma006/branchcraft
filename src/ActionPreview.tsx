import { ArrowRight } from 'lucide-react';
export function ActionPreview({kind,current,target,start}:{kind:string;current:string;target?:string;start?:string}) {
 const destination=target || (kind==='branch'?'new branch':'choose a branch');
 const merge=kind==='merge',rebase=kind==='rebase',branch=kind==='branch';
 if(!merge&&!rebase&&!branch&&kind!=='switch')return null;
 return <div className={'action-preview action-preview-'+kind}>
  <div className="action-route"><span><small>{merge?'From':rebase?'Replay':branch?'From':'Leave'}</small><strong>{branch?start:merge?destination:current}</strong></span><ArrowRight size={18}/><span><small>{merge?'Into':rebase?'On top of':branch?'Create & switch':'Switch to'}</small><strong>{merge?current:destination}</strong></span></div>
  <svg viewBox="0 0 340 68" role="img" aria-label={merge?`Merge ${destination} into ${current}`:rebase?`Replay ${current} on ${destination}`:branch?`Create ${destination} from ${start}`:`Switch from ${current} to ${destination}`}>
   <path d="M25 48H310" stroke="#776791" strokeWidth="2" fill="none"/>
   {merge?<><path d="M85 48Q110 16 145 16H215Q250 16 275 48" fill="none" stroke="#69d9b3" strokeWidth="2"/><circle cx="150" cy="16" r="6" fill="#69d9b3"/><circle cx="215" cy="16" r="6" fill="#69d9b3"/><circle className="preview-result" cx="275" cy="48" r="8" fill="#b3a0ff"/></>:branch?<><path d="M145 48Q175 16 220 16H290" fill="none" stroke="#69d9b3" strokeWidth="2"/><circle className="preview-result" cx="290" cy="16" r="7" fill="#69d9b3"/></>:rebase?<><path d="M85 48Q105 16 125 16H165" fill="none" stroke="#7e8193" strokeDasharray="4 4"/><circle cx="130" cy="16" r="5" fill="none" stroke="#7e8193"/><circle cx="165" cy="16" r="5" fill="none" stroke="#7e8193"/><path d="M185 16H260" fill="none" stroke="#69d9b3" strokeDasharray="3 4"/><path d="m255 11 7 5-7 5" fill="none" stroke="#69d9b3"/><circle cx="260" cy="48" r="7" fill="#69d9b3"/><circle className="preview-result" cx="300" cy="48" r="7" fill="#69d9b3"/></>:<circle className="preview-result" cx="280" cy="48" r="8" fill="#69d9b3"/>}
   {[25,85,145,205].map(x=><circle key={x} cx={x} cy="48" r="6" fill="#b3a0ff"/>)}
  </svg>
  <small>{merge?`${current} receives the changes. ${destination} stays.`:rebase?'Rewrites commit IDs. Your branch stays selected.':branch?'The original branch stays where it is.':'Your files will match the selected branch.'}</small>
 </div>;
}
