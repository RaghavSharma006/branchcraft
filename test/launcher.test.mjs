import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import net from 'node:net';
import {openBrowser} from '../server/browser.mjs';

test('launcher rejects unsupported arguments and non-local browser targets',()=>{
  for(const args of [['--typo'],['--mcp','--open'],['--welcome','.'],['--port','0']])
    assert.throws(()=>execFileSync(process.execPath,['bin/branchcraft.mjs',...args],{stdio:'pipe'}));
  for(const url of ['https://example.com','http://127.0.0.1:4317/;echo hi','file:///etc/passwd'])assert.throws(()=>openBrowser(url));
});

test('welcome launcher starts without requiring the working folder to be a repository',{timeout:15000},async()=>{
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const n=s.address().port;s.close(()=>resolve(n));});});
  const child=spawn(process.execPath,['bin/branchcraft.mjs','--welcome','--port',String(port)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  try {
    const token=await new Promise((resolve,reject)=>{let out='';child.on('error',reject);child.on('exit',()=>reject(Error('Launcher stopped')));child.stdout.on('data',b=>{out+=b;const match=out.match(/session=([a-f0-9]{64})/);if(match)resolve(match[1]);});});
    const response=await fetch(`http://127.0.0.1:${port}/api/session`,{method:'POST',headers:{'X-Branchcraft-Token':token}});
    assert.equal(response.status,200);assert.equal(await response.json(),null);
  } finally {const closed=new Promise(resolve=>child.once('close',resolve));child.kill();await closed;}
});
