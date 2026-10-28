import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { git, state, runAction, validPath } from '../server/git.mjs';
test('real Git workflow: selected commit, branching, merge conflict, abort, shelf and rebase', async () => {
 const repo = await mkdtemp(path.join(os.tmpdir(), 'branchcraft-test-'));
 try {
  await git(repo, ['init','-b','main']); await git(repo,['config','user.name','Test']); await git(repo,['config','user.email','test@localhost']);
  await writeFile(path.join(repo,'a.txt'),'initial\n'); await git(repo,['add','.']); await git(repo,['commit','-m','Initial']);
  const act = async input => runAction(repo,{...input,expectedHead:(await state(repo)).head});
  await act({action:'branch',name:'feature'});
  await writeFile(path.join(repo,'a.txt'),'feature\n');
  await act({action:'commit',files:['a.txt'],message:'Feature change'});
  await act({action:'switch',target:'main'});
  await writeFile(path.join(repo,'a.txt'),'main\n'); await act({action:'commit',files:['a.txt'],message:'Main change'});
  const conflict = await act({action:'merge',target:'feature'});
  assert.equal(conflict.needsAttention,true); assert.equal(conflict.state.operation,'merge'); assert.equal(conflict.state.files[0].conflict,true);
  await act({action:'abort'}); assert.equal((await state(repo)).operation,null);
  await writeFile(path.join(repo,'new.txt'),'unfinished'); await act({action:'stash'}); assert.equal((await state(repo)).files.length,0);
  await act({action:'stash-apply',target:'stash@{0}'}); assert.ok((await state(repo)).files.some(f=>f.path==='new.txt'));
  await act({action:'commit',files:['new.txt'],message:'New file'});
  await act({action:'branch',name:'clean-feature'}); await writeFile(path.join(repo,'b.txt'),'another'); await act({action:'commit',files:['b.txt'],message:'Another'});
  await act({action:'rebase',target:'main'}); assert.equal((await state(repo)).current,'clean-feature');
  await assert.rejects(runAction(repo,{action:'branch',name:'stale',expectedHead:'bad'}),/changed/);
 } finally { await rm(repo,{recursive:true,force:true}); }
});
test('reject unsafe path operands',()=>{for(const value of ['../secret','.git/config','C:/secret','x/../../y']) assert.throws(()=>validPath(value));});
