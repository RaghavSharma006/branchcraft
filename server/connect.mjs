import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRepository } from './git.mjs';
export async function connectionConfig(client, folder) {
  if (!['codex','claude','cursor','generic'].includes(client)) throw Error('Choose codex, claude, cursor or generic.');
  const repo = await openRepository(path.resolve(folder));
  const command = process.execPath;
  const args = [fileURLToPath(new URL('../bin/branchcraft.mjs', import.meta.url)),repo,'--mcp'];
  if(client==='codex') return '[mcp_servers.branchcraft]\ncommand = '+JSON.stringify(command)+'\nargs = '+JSON.stringify(args)+'\n';
  return JSON.stringify({mcpServers:{branchcraft:{command,args,...(client==='claude'?{type:'stdio'}:{})}}},null,2)+'\n';
}
