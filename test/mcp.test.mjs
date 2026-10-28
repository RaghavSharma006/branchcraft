import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {connectionConfig} from '../server/connect.mjs';

test('client configurations preserve paths and reject unknown clients',async()=>{
 const c=JSON.parse(await connectionConfig('cursor','.'));
 assert.equal(c.mcpServers.branchcraft.command,process.execPath);
 assert.equal(c.mcpServers.branchcraft.args.at(-1),'--mcp');
 assert.match(await connectionConfig('codex','.'),/^\[mcp_servers.branchcraft\]/);
 assert.equal(JSON.parse(await connectionConfig('claude','.')).mcpServers.branchcraft.type,'stdio');
 await assert.rejects(connectionConfig('unknown','.'),/Choose/);
});

test('MCP stdio negotiates, survives invalid requests, reads status and rejects stale changes',{timeout:30000},async()=>{
 const child=spawn(process.execPath,['bin/branchcraft.mjs',process.cwd(),'--mcp'],{stdio:['pipe','pipe','pipe']});
 const waiting=new Map();let seq=0;let stderr='';child.stderr.on('data',b=>stderr+=b);
 const lines=readline.createInterface({input:child.stdout});
 lines.on('line',line=>{const r=JSON.parse(line);waiting.get(r.id)?.(r);waiting.delete(r.id);});
 const call=(method,params)=>new Promise(resolve=>{const id=++seq;waiting.set(id,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 try{
  const init=await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}});
  assert.equal(init.result.protocolVersion,'2024-11-05');
  child.stdin.write('null\n');
  const list=await call('tools/list',{});assert.equal(list.result.tools.length,4);
  const status=await call('tools/call',{name:'git_status',arguments:{}});assert.equal(status.result.isError,undefined);
  assert.ok(JSON.parse(status.result.content[0].text).path);
  const stale=await call('tools/call',{name:'git_action',arguments:{action:'branch',name:'never-created',expectedHead:'stale'}});
  assert.equal(stale.result.isError,true);assert.match(stale.result.content[0].text,/changed/);
  assert.equal(stderr,'');
 }finally{child.stdin.end();child.kill();lines.close();}
});
