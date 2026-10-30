const vscode=require('vscode');
const path=require('node:path');
const {spawn}=require('node:child_process');
const net=require('node:net');
let child, pending, address, view, panels=new Set(), generation=0;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(url){return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://127.0.0.1:*; style-src 'unsafe-inline'"><style>html,body,iframe{width:100%;height:100%;padding:0;margin:0;border:0;background:#101218}p{padding:20px;color:#ccc;font:13px system-ui}</style></head><body>${url?`<iframe title="Branchcraft local Git" src="${escape(url)}"></iframe>`:'<p>Use “Branchcraft: Open Local Repository” from the Command Palette to begin. Node.js 20+ and Git must be installed.</p>'}</body></html>`;}
function render(){if(view)view.webview.html=html(address);for(const panel of panels)panel.webview.html=html(address);}
function stop(){generation++;if(child){child.kill();child=undefined;}address=undefined;pending=undefined;}
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function launch(context,repo){
 if(!vscode.workspace.isTrusted)throw Error('Trust this workspace before starting local Git.');
 if(repo.scheme!=='file')throw Error('This version supports local folders only.');
 stop();const version=generation;render();const port=await freePort();if(version!==generation)return;
 const executable=vscode.workspace.getConfiguration('branchcraft').get('nodePath','node');
 const proc=spawn(executable,[path.join(context.extensionPath,'runtime','bin','branchcraft.mjs'),repo.fsPath,'--port',String(port)],{cwd:repo.fsPath,windowsHide:true,stdio:['ignore','pipe','pipe']});child=proc;
 pending=new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>{proc.kill();reject(Error('Local Git took too long to start.'));},20000);
 const fail=e=>{clearTimeout(timer);reject(e);};proc.once('error',()=>fail(Error('Could not start Node.js. Install Node.js 20+ or set Branchcraft: Node Path.')));
 proc.stderr.on('data',b=>{errors=(errors+b).slice(-2000);});
 proc.once('exit',code=>{if(version===generation){address=undefined;child=undefined;render();}fail(Error(`Local Git stopped (${code}). ${errors}`));});
 proc.stdout.on('data',b=>{output+=b;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\/\?session=[a-f0-9]+/);if(match&&version===generation){clearTimeout(timer);address=match[0];render();resolve(address);}});
 });return pending;
}
async function choose(context){
 const folders=vscode.workspace.workspaceFolders||[];
 let repo;if(folders.length===1)repo=folders[0].uri;
 else if(folders.length>1){const item=await vscode.window.showQuickPick(folders.map(f=>({label:f.name,description:f.uri.fsPath,uri:f.uri})),{placeHolder:'Choose a Git repository'});repo=item?.uri;}
 else repo=(await vscode.window.showOpenDialog({canSelectFolders:true,canSelectFiles:false,canSelectMany:false,openLabel:'Open Git repository'}))?.[0];
 if(!repo)return;await launch(context,repo);
}
function activate(context){
 const run=fn=>async()=>{try{await fn();}catch(e){vscode.window.showErrorMessage('Branchcraft: '+e.message);}};
 context.subscriptions.push(vscode.window.registerWebviewViewProvider('branchcraft.graph',{resolveWebviewView(v){view=v;v.webview.options={enableScripts:true};v.webview.html=html(address);v.onDidDispose(()=>{if(view===v)view=undefined;});}},{webviewOptions:{retainContextWhenHidden:true}}));
 context.subscriptions.push(vscode.commands.registerCommand('branchcraft.open',run(async()=>{await vscode.commands.executeCommand('workbench.view.extension.branchcraft');await choose(context);})),vscode.commands.registerCommand('branchcraft.editor',run(async()=>{if(!address)await choose(context);if(!address)return;const panel=vscode.window.createWebviewPanel('branchcraft.editor','Branchcraft',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true});panels.add(panel);panel.webview.html=html(address);panel.onDidDispose(()=>panels.delete(panel));})),vscode.commands.registerCommand('branchcraft.online',()=>vscode.env.openExternal(vscode.Uri.parse('https://branchcraft-rho.vercel.app/'))),{dispose:stop});
}
module.exports={activate,deactivate:stop};
