import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryName, connect, account, repositories, pullRequests, checks, createPull, cloneRepository } from '../server/github.mjs';
test('GitHub integration validates destinations and handles API data without exposing credentials', async () => {
 assert.equal(repositoryName('git@github.com:owner/project.git'),'owner/project');
 assert.equal(repositoryName('https://github.com/owner/project'),'owner/project');
 for(const x of ['https://evil.com/a/b','a/../b','a/b?token=secret','--upload-pack=x','.git','../repo'])assert.throws(()=>repositoryName(x));
 const original=globalThis.fetch; const calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url,options});const endpoint=String(url).replace('https://api.github.com/','');
  let value;
  if(endpoint==='user')value={login:'fixture-user'};
  else if(endpoint.startsWith('user/repos'))value=[{full_name:'owner/project',private:true,default_branch:'main',html_url:'https://github.com/owner/project'}];
  else if(endpoint==='repos/owner/project/pulls'&&options.method==='POST')value={number:2,html_url:'https://github.com/owner/project/pull/2'};
  else if(endpoint.startsWith('repos/owner/project/pulls?'))value=[{number:1,title:'Change',html_url:'https://github.com/owner/project/pull/1',user:{login:'author'},head:{ref:'feature',sha:'a'.repeat(40)},base:{ref:'main'}}];
  else if(endpoint.includes('/check-runs'))return new Response(JSON.stringify({message:'Permission denied'}),{status:403});
  else if(endpoint.includes('/status'))value={statuses:[{context:'build',state:'success',target_url:'https://github.com/owner/project/actions'}]};
  else throw Error('Unexpected endpoint '+endpoint);
  return new Response(JSON.stringify(value),{status:200});
 };
 try {
  const token='fixture-token-not-a-real-credential';
  assert.deepEqual(await connect(token),{connected:true,login:'fixture-user',source:'session'});
  assert.equal((await account()).login,'fixture-user');
  assert.equal((await repositories({page:2})).items[0].private,true);
  assert.equal((await pullRequests({repository:'owner/project'})).items[0].head,'feature');
  const result=await checks({repository:'owner/project',sha:'a'.repeat(40)});assert.equal(result.items[0].status,'success');assert.match(result.warnings[0],/403/);
  const pr=await createPull({repository:'owner/project',head:'feature',base:'main',title:'A change',body:'Description\nwith newline',draft:true});assert.equal(pr.number,2);
  const posted=JSON.parse(calls.find(c=>c.options.method==='POST').options.body);assert.equal(posted.draft,true);assert.match(posted.body,/\n/);
  assert.ok(calls.every(c=>c.url.startsWith('https://api.github.com/')));
  assert.ok(calls.every(c=>!c.url.includes(token)));
  await assert.rejects(createPull({repository:'owner/project',head:'main',base:'main',title:'x',body:''}),/differ/);
  await assert.rejects(cloneRepository({repository:'owner/project',destination:process.cwd()}),/already exists/);
 } finally {globalThis.fetch=original;}
});
