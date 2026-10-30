import {useState} from 'react';
const steps=[
 ['Your position','The highlighted node is your current commit. Branch labels point to saved versions. Clicking a node only selects it.','main','feature'],
 ['Save your work','Commit saves selected files. Stash puts unfinished work aside. Uncommitted changes must be handled before switching.','3 edited files','Commit / Stash'],
 ['Switch branches','Choose a destination. Check the names, colors and commit IDs, then switch. Your files change to that version.','current branch','destination'],
 ['Combine work','Merge brings another branch into yours. Rebase replays your commits on a new base and changes their IDs.','source / new base','current branch'],
 ['Recover','Undo reverses supported actions from this session. Revert creates a new commit that reverses an older change.','recent action','Undo / Revert'],
];
export function QuickTutorial({onClose}:{onClose:()=>void}){const [step,setStep]=useState(0);const [title,text,left,right]=steps[step];return <section className="quick-tutorial"><small>QUICK TOUR · {step+1} / {steps.length}</small><h2>{title}</h2><div className="tour-mini"><span><i/>{left}</span><b>→</b><span><i/>{right}</span></div><p>{text}</p><div className="tour-progress">{steps.map((s,i)=><button key={s[0]} aria-label={'Step '+(i+1)+': '+s[0]} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}/>)}</div><div className="tour-buttons"><button type="button" className="outline" disabled={!step} onClick={()=>setStep(step-1)}>Back</button><button type="button" className="primary" onClick={()=>step===steps.length-1?onClose():setStep(step+1)}>{step===steps.length-1?'Done':'Next'}</button></div><small>Illustrations only · this tour never changes your repository.</small></section>}
