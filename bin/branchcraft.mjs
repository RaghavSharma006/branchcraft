#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Branchcraft — visual Git, without the command memorization.\n\n  branchcraft [folder]             Start the local UI (port 4317)\n  branchcraft [folder] --port 4318 Use a different local port\n  branchcraft [folder] --mcp       Start the AI tool server over stdio\n\nGenerate client settings: branchcraft --connect codex|claude|cursor|generic /path/to/repo\n\nRequires Node.js 20+ and Git. Repositories remain normal Git repositories.');
} else if (args[0] === '--connect') {
  if (!args[1] || !args[2] || args.length!==3) throw Error('Usage: branchcraft --connect codex|claude|cursor|generic /absolute/repository');
  const {connectionConfig}=await import('../server/connect.mjs');
  process.stdout.write(await connectionConfig(args[1],args[2]));
} else {
  const portAt = args.indexOf('--port');
  if (portAt >= 0) { const port = Number(args[portAt + 1]); if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be between 1024 and 65535.'); process.env.BRANCHCRAFT_PORT = String(port); args.splice(portAt, 2); }
  const mcp = args.includes('--mcp'); const folder = args.find(a => a !== '--mcp') || process.cwd();
  process.argv = [process.execPath, process.argv[1], folder];
  await import(mcp ? '../server/mcp.mjs' : '../server/index.mjs');
}
