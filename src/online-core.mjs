export function parseRepository(input) {
 if(typeof input!=='string')throw Error('Enter owner/repository or a GitHub URL.');
 const match=input.trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
 if(!match||['.','..'].includes(match[1])||['.','..'].includes(match[2]))throw Error('Use a repository URL such as https://github.com/owner/project.');
 return match[1]+'/'+match[2];
}
export function onlineEndpoint(input) {
 const repo=parseRepository(input.repository),root='repos/'+repo;
 const page=Number(input.page||1);if(!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Invalid page.');
 switch(input.kind){
  case 'repository':return root;
  case 'branches':return `${root}/branches?per_page=100&page=${page}`;
  case 'branch':if(typeof input.branch!=='string'||!input.branch||input.branch.length>1024)throw Error('Choose a branch.');return root+'/branches/'+encodeURIComponent(input.branch);
  case 'commits':if(!/^[a-f0-9]{40}$/i.test(input.sha||''))throw Error('Choose a branch tip.');return `${root}/commits?sha=${input.sha}&per_page=30&page=${page}`;
  case 'commit':if(!/^[a-f0-9]{40}$/i.test(input.sha||''))throw Error('Choose a commit.');return `${root}/commits/${input.sha}?per_page=100&page=${page}`;
  default:throw Error('Unsupported online operation.');
 }
}
export async function readPublic(input, fetcher=fetch) {
 const response=await fetcher('https://api.github.com/'+onlineEndpoint(input),{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(25000),credentials:'omit'});
 const data=await response.json();
 if(!response.ok){
  if(response.status===403||response.status===429){const reset=Number(response.headers.get('x-ratelimit-reset'));throw Error(response.headers.get('x-ratelimit-remaining')==='0'?`GitHub’s public API limit was reached.${reset?' Try again after '+new Date(reset*1000).toLocaleTimeString()+'.':''} In the local app, a connected GitHub account has a separate limit.`:`GitHub access was limited: ${data.message||'try again later'}`);}
  if(response.status===404)throw Error('Repository or commit not found. Check the URL; private repositories require a connected account in the local app.');
  if(response.status===409)throw Error('This repository has no commit history yet.');
  throw Error(`GitHub ${response.status}: ${data.message||'Request failed'}`);
 }
 return data;
}
// Preserve real parent edges. Sort children before parents, even when author dates are skewed.
export function historyLayout(commits) {
 const byHash=new Map(commits.map(c=>[c.sha,c])),incoming=new Map(commits.map(c=>[c.sha,0]));
 for(const c of commits)for(const p of c.parents)if(incoming.has(p.sha))incoming.set(p.sha,incoming.get(p.sha)+1);
 const ready=commits.filter(c=>incoming.get(c.sha)===0),ordered=[];
 while(ready.length){const c=ready.shift();ordered.push(c);for(const p of c.parents)if(incoming.has(p.sha)){incoming.set(p.sha,incoming.get(p.sha)-1);if(incoming.get(p.sha)===0)ready.push(byHash.get(p.sha));}}
 const used=new Set(ordered.map(c=>c.sha));for(const c of commits)if(!used.has(c.sha))ordered.push(c);
 const lanes=[];const nodes=ordered.map((c,i)=>{let lane=lanes.indexOf(c.sha);if(lane<0){lane=lanes.indexOf(null);if(lane<0)lane=lanes.length;}lanes[lane]=null;for(let j=0;j<c.parents.length;j++){const p=c.parents[j].sha;if(lanes.includes(p))continue;let slot=j===0?lane:lanes.indexOf(null);if(slot<0)slot=lanes.length;lanes[slot]=p;}return {...c,lane,y:i*72+36};});
 return {nodes,lanes:Math.max(1,...nodes.map(c=>c.lane+1))};
}
