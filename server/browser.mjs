import {spawn} from 'node:child_process';

// Only a server-generated loopback URL can reach the platform launcher.
export function openBrowser(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/(?:\?session=[a-f0-9]+)?$/.test(url)) throw Error('Invalid local launch URL');
  const [command,args] = process.platform === 'win32'
    ? ['rundll32.exe',['url.dll,FileProtocolHandler',url]]
    : process.platform === 'darwin' ? ['open',[url]] : ['xdg-open',[url]];
  const child=spawn(command,args,{stdio:'ignore',windowsHide:true});
  child.on('error',()=>console.error('Could not open a browser. Open the printed local link.'));
  child.unref();
}
