import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { git, state, commitDetails } from '../server/git.mjs';
test('project switching, remote classification, hover evidence and stale-project rejection', async () => {
 const roots = []; let server;
 try {
  for (const name of ['alpha','beta']) {
   const root=await mkdtemp(path.join(os.tmpdir(),'branchcraft-project-')); roots.push(root);
   await git(root,['init','-b',name]); await git(root,['config','user.name','Fixture']); await git(root,['config','user.email','fixture@localhost']);
   await writeFile(path.join(root,'notes.txt'),name+'\n'); await git(root,['add','.']); await git(root,['commit','-m',name+' checkpoint','-m','Full message body']);
  }
  const head=(await state(roots[0])).head;
  await git(roots[0],['branch','origin/local-name']); await git(roots[0],['update-ref','refs/remotes/upstream/real-remote',head]);
  const s=await state(roots[0]); assert.equal(s.branches.find(b=>b.name==='origin/local-name').remote,false); assert.equal(s.branches.find(b=>b.name==='upstream/real-remote').remote,true);
  const detail=await commitDetails(roots[0],{hash:head}); assert.equal(detail.files[0].path,'notes.txt'); assert.equal(detail.additions,1); assert.match(detail.message,/Full message body/);
  server=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,BRANCHCRAFT_PORT:'4318'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  const html=await (await fetch('http://127.0.0.1:4318/')).text(); const token=html.match(/name="branchcraft-session" content="([a-f0-9]+)"/)[1];
  const api=async(route,input={})=>{const r=await fetch('http://127.0.0.1:4318/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Branchcraft-Token':token},body:JSON.stringify(input)});return {status:r.status,data:await r.json()};};
  assert.equal((await fetch('http://127.0.0.1:4318/api/session',{method:'POST'})).status,401);
  assert.equal((await fetch('http://127.0.0.1:4318/api/session',{method:'POST',headers:{'X-Branchcraft-Token':'é'.repeat(64)}})).status,401);
  assert.equal((await fetch('http://127.0.0.1:4318/api/session',{method:'POST',headers:{'X-Branchcraft-Token':token,Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch('http://127.0.0.1:4318/api/session',{headers:{'X-Branchcraft-Token':token}})).status,405);
  assert.equal((await api('session')).data,null);
  assert.equal((await api('open',{path:roots[0]})).data.current,'alpha');
  assert.equal((await api('open',{path:roots[1]})).data.current,'beta');
  assert.equal((await api('action',{action:'branch',name:'wrong-project',expectedRepo:roots[0],expectedHead:head})).status,400);
  assert.equal((await api('open',{path:roots[1]+'/missing'})).status,400);
  assert.equal((await api('session')).data.current,'beta');
 } finally { if(server){server.kill();await new Promise(resolve=>server.once('close',resolve));} for(const root of roots)await rm(root,{recursive:true,force:true}); }
});
