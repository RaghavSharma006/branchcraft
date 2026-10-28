import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { git, openRepository } from './git.mjs';
import { onlineEndpoint } from '../src/online-core.mjs';
const exec = promisify(execFile);
export async function readOnline(input) { return request(onlineEndpoint(input)); }
let credential = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
let source = credential ? 'environment' : 'none';
export function repositoryName(value) {
 if (typeof value !== 'string') throw Error('Choose a GitHub repository.');
 const match = value.trim().match(/^(?:(?:https:\/\/github\.com\/|git@github\.com:))?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
 if (!match || ['.','..'].includes(match[1]) || ['.','..'].includes(match[2])) throw Error('Use owner/repository or a github.com repository URL.');
 return match[1]+'/'+match[2];
}
export function githubGitEnvironment() { return credential ? { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+credential).toString('base64') } : {}; }
export async function request(endpoint, options = {}, token = credential) {
 const response = await fetch('https://api.github.com/'+endpoint, { ...options, signal: AbortSignal.timeout(30000), redirect:'error', headers: { Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'Branchcraft', ...(token ? { Authorization:'Bearer '+token } : {}), ...(options.body ? {'Content-Type':'application/json'} : {}) } });
 const data = await response.json();
 if (!response.ok) throw Error(`GitHub ${response.status}: ${data.message || 'Request failed'}`);
 return data;
}
export async function connect(token) {
 if (typeof token !== 'string' || !token.trim() || token.length>1000 || /\s/.test(token)) throw Error('Enter a valid GitHub access token.');
 const user=await request('user',{},token); credential=token;source='session';return {connected:true,login:user.login,source};
}
export async function account() {
 if(!credential) { try { const r=await exec('gh',['auth','token','--hostname','github.com'],{encoding:'utf8',windowsHide:true,timeout:5000});credential=r.stdout.trim();if(credential)source='GitHub CLI'; } catch {} }
 if(!credential)return {connected:false,source:'none'};
 try {const u=await request('user');return {connected:true,login:u.login,source};}catch(e){return {connected:false,source,error:e.message};}
}
export async function repositories(input) {
 const page=Math.max(1,Math.min(100,Number(input.page)||1));
 const rows=await request(`user/repos?per_page=30&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`);
 return {items:rows.map(r=>({name:r.full_name,description:r.description,private:r.private,url:r.html_url,branch:r.default_branch})),hasMore:rows.length===30,page};
}
export async function pullRequests(input) {
 const repo=repositoryName(input.repository),page=Math.max(1,Math.min(100,Number(input.page)||1));
 const rows=await request(`repos/${repo}/pulls?state=open&per_page=30&page=${page}`);
 return {items:rows.map(p=>({number:p.number,title:p.title,url:p.html_url,draft:p.draft,author:p.user.login,head:p.head.ref,base:p.base.ref,sha:p.head.sha})),hasMore:rows.length===30,page};
}
export async function checks(input) {
 const repo=repositoryName(input.repository);if(!/^[a-f0-9]{40}$/i.test(input.sha||''))throw Error('Select a pull request commit.');
 const base=`repos/${repo}/commits/${input.sha}`;
 const results=await Promise.allSettled([request(base+'/check-runs?per_page=100'),request(base+'/status?per_page=100')]);
 return {items:results.flatMap((r,i)=>r.status==='fulfilled' ? (i===0?r.value.check_runs.map(c=>({name:c.name,status:c.conclusion||c.status,url:c.html_url})):r.value.statuses.map(c=>({name:c.context,status:c.state,url:c.target_url}))) : []),warnings:results.filter(r=>r.status==='rejected').map(r=>r.reason.message)};
}
export async function createPull(input) {
 const repo=repositoryName(input.repository);
 for(const key of ['title','head','base'])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>250)throw Error('Provide a title, source branch and base branch.');
 if(input.head===input.base)throw Error('Source and base branches must differ.');
 if(typeof input.body!=='string'||input.body.length>60000)throw Error('Description is too long.');
 const p=await request(`repos/${repo}/pulls`,{method:'POST',body:JSON.stringify({title:input.title,head:input.head,base:input.base,body:input.body,draft:!!input.draft})});
 return {number:p.number,url:p.html_url};
}
export async function cloneRepository(input) {
 const repo=repositoryName(input.repository);
 if(typeof input.destination!=='string'||!path.isAbsolute(input.destination))throw Error('Choose a full path for the new local folder.');
 const destination=path.resolve(input.destination);
 try {await lstat(destination);throw Error('Destination already exists. Choose a new folder.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const parent=await realpath(path.dirname(destination));
 await git(parent,['clone','--','https://github.com/'+repo+'.git',destination],githubGitEnvironment());
 return openRepository(destination);
}
