import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepository,onlineEndpoint,readPublic,historyLayout } from '../src/online-core.mjs';
test('online URLs and endpoints cannot escape GitHub or inject queries',()=>{
 assert.equal(parseRepository('https://github.com/RaghavSharma006/PolyCrypt.git/'),'RaghavSharma006/PolyCrypt');
 for(const x of ['https://evil.example/a/b','owner/../secret','owner/repo?x=1','../repo','https://github.com/owner/repo/tree/main'])assert.throws(()=>parseRepository(x));
 assert.equal(onlineEndpoint({repository:'a/b',kind:'branch',branch:'feature/a&b'}),'repos/a/b/branches/feature%2Fa%26b');
 assert.throws(()=>onlineEndpoint({repository:'a/b',kind:'commit',sha:'main?token=secret'}));
 assert.throws(()=>onlineEndpoint({repository:'a/b',kind:'branches',page:-1}));
 assert.throws(()=>onlineEndpoint({repository:'a/b',kind:'delete'}));
});
test('public transport uses read-only GitHub API without credentials',async()=>{
 const calls=[];const value=await readPublic({repository:'owner/repo',kind:'commits',sha:'a'.repeat(40),page:2},async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{sha:'a'.repeat(40)}]));});
 assert.equal(value.length,1);assert.match(calls[0].url,/per_page=30&page=2$/);assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.method,undefined);
});
test('rate limits, missing repositories and empty histories are explained',async()=>{
 const input={repository:'owner/repo',kind:'repository'};
 await assert.rejects(readPublic(input,async()=>new Response('{}',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1800000000'}})),/limit was reached/);
 await assert.rejects(readPublic(input,async()=>new Response('{}',{status:404})),/not found/);
 await assert.rejects(readPublic(input,async()=>new Response('{}',{status:409})),/no commit history/);
});
test('graph retains merge edges, topological order and missing-parent boundaries',()=>{
 const c=(sha,parents)=>({sha,parents:parents.map(sha=>({sha})),commit:{message:sha,author:{name:'A',date:'2026-01-01'}}});
 const {nodes}=historyLayout([c('root',[]),c('merge',['left','right']),c('left',['root']),c('right',['root']),c('unrelated',['not-loaded'])]);
 const position=new Map(nodes.map((n,i)=>[n.sha,i]));
 for(const n of nodes)for(const p of n.parents)if(position.has(p.sha))assert.ok(position.get(n.sha)<position.get(p.sha));
 assert.equal(nodes.find(n=>n.sha==='merge').parents.length,2);assert.equal(nodes.find(n=>n.sha==='unrelated').parents[0].sha,'not-loaded');
 assert.equal(new Set(nodes.map(n=>n.sha)).size,5);
});
