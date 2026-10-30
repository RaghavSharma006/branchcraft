import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const require=createRequire(import.meta.url);

test('editor adapter launches real local Git, enforces trust and cleans up its server', {timeout:30000}, async()=>{
  const commands=new Map(),errors=[],children=[];let provider;
  const root=process.cwd();
  const vscode={
    workspace:{isTrusted:false,workspaceFolders:[{name:'Test',uri:{scheme:'file',fsPath:root}}],getConfiguration:()=>({get:()=>process.execPath})},
    window:{registerWebviewViewProvider:(_,p)=>{provider=p;return {dispose(){}};},showErrorMessage:m=>errors.push(m)},
    commands:{registerCommand:(name,fn)=>{commands.set(name,fn);return {dispose(){}};},executeCommand:async()=>{}},
  };
  const context={extensionPath:path.join(root,'extensions','vscode'),subscriptions:[]};
  const module={exports:{}};
  const source=await readFile('extensions/vscode/extension.cjs','utf8');
  vm.runInNewContext(source,{module,require:name=>name==='vscode'?vscode:name==='node:child_process'?{spawn:(node,args,options)=>{
    assert.equal(args[0],path.join(context.extensionPath,'runtime','bin','branchcraft.mjs'));
    assert.equal(args[1],root);assert.equal(options.windowsHide,true);
    const proc=spawn(node,[path.join(root,'bin','branchcraft.mjs'),...args.slice(1)],options);children.push(proc);return proc;
  }}:require(name),setTimeout,clearTimeout,console});
  const adapter=module.exports;
  try {
    adapter.activate(context);const view={webview:{},onDidDispose(){}};provider.resolveWebviewView(view);
    await commands.get('branchcraft.open')();assert.match(errors.pop(),/Trust this workspace/);assert.equal(children.length,0);
    vscode.workspace.isTrusted=true;
    await commands.get('branchcraft.open')();assert.equal(errors.length,0);assert.equal(children.length,1);
    const url=view.webview.html.match(/src="(http:[^"]+)"/)[1];
    const parsed=new URL(url);const token=parsed.searchParams.get('session');
    const response=await fetch(parsed.origin+'/api/session',{method:'POST',headers:{'X-Branchcraft-Token':token}});
    assert.equal(response.status,200);assert.equal(path.resolve((await response.json()).path),root);
    assert.equal((await fetch(parsed.origin)).status,200);
    const closed=new Promise(resolve=>children[0].once('close',resolve));adapter.deactivate();await closed;
    await assert.rejects(fetch(parsed.origin));
  } finally {adapter.deactivate();for(const child of children)if(child.exitCode===null)child.kill();}
});
