# Branchcraft

**Real Git. A visual workspace. Tools your AI can use.**

Branchcraft turns branches, commits and Git operations into a small local web app. Explore a repository as connected nodes, inspect changes, and choose your next move without memorizing commands. Use the same Git engine from an AI client through MCP.

[Try the online explorer](https://branchcraft-rho.vercel.app/) · [Download v0.2.0](https://github.com/RaghavSharma006/branchcraft/releases/tag/v0.2.0) · [AI client setup](integrations/README.md)

> **Alpha:** core workflows are tested, but this is not a replacement for backups. No Electron, database, account requirement for local work, or npm runtime dependencies.

## What you can do

- **See your history:** interactive commit graph, branch labels, hover details and complete local diffs.
- **Work with real Git:** selected-file commits, branches, switching, merging, rebasing, cherry-pick, revert, tags and stash.
- **Recover and investigate:** reflog browsing, recovery branches, linear commit squash and bisect.
- **Browse GitHub without cloning:** paste a public repository URL to explore its branches, commits and patches.
- **Connect GitHub locally:** repository browsing, cloning, pull requests and CI status with your existing credentials.
- **Use an AI client:** portable MCP tools and an optional agent skill for Codex, Claude Code, Cursor or another local stdio MCP client.

## Choose your workspace

| | Local app | Hosted explorer |
|---|---|---|
| Opens | Git repositories on your computer | GitHub repositories through the API |
| Changes files | Yes, through explicit Git actions | No; browsing only |
| Works offline | Local history, diffs and Git operations | No |
| Needs a clone | Yes, or an existing local repository | No |
| GitHub account | Optional for local work | Not needed for public browsing |

The hosted website cannot access your local files. For local work, keep the Branchcraft process running and open **http://127.0.0.1:4317/**. Fetch, pull, push and GitHub API requests need a network connection.

## Quick start

### Download the built tool

Install Node.js 20+ and Git, then download `branchcraft-0.2.0.tgz` from [Releases](https://github.com/RaghavSharma006/branchcraft/releases).

```sh
npm install -g ./branchcraft-0.2.0.tgz
branchcraft /absolute/path/to/your/repository
```

On Windows, quote paths containing spaces:

```powershell
branchcraft "C:\Projects\My App"
```

Open the localhost link printed by the launcher. Use **Change project** to open a different repository. The local link may contain a session credential; do not share it.

```sh
branchcraft /path/to/repo --port 4318
branchcraft --help
```

The package is distributed as a release archive; it is **not published to the npm registry**. Installing the archive adds the `branchcraft` command without downloading runtime dependencies.

### Build from source

Use Node.js **22.12+** and Git for development:

```sh
git clone https://github.com/RaghavSharma006/branchcraft.git
cd branchcraft
npm ci
npm run build
node bin/branchcraft.mjs /absolute/path/to/your/repository
```

`npm run dev` runs the Vite frontend. Use the built local server above to work with real Git; the standalone development frontend is not a substitute for its authenticated backend.

## Connect your AI client

Generate configuration for the repository the agent should use:

```sh
branchcraft --connect codex /path/to/repo
branchcraft --connect claude /path/to/repo
branchcraft --connect cursor /path/to/repo
branchcraft --connect generic /path/to/repo
```

These commands print settings without editing existing configuration. Merge the result into your client's MCP settings, then reconnect the client. See the [setup guide](integrations/README.md) for file locations and the optional [Branchcraft skill](skills/branchcraft/SKILL.md).

| Tool | Purpose |
|---|---|
| `git_status` | Repository path, branches, commits, working changes and active operation |
| `git_diff` | A selected commit or working-file diff |
| `git_recovery` | Recent reflog entries |
| `git_action` | An explicit Git operation with a fresh `expectedHead` |

MCP runs over local stdio and is fixed to its launch repository. Changing projects in the GUI does not retarget it. The AI client's permission settings govern tool calls; the skill does not grant blanket mutation or publishing permission.

## GitHub access

Public online browsing requires no login and is subject to GitHub API rate limits. Branches, commits and changed files load in pages. GitHub may omit large or binary patches and limits a commit file listing to 3,000 files.

For authenticated features in the local GUI, use an existing GitHub CLI login, `GH_TOKEN` / `GITHUB_TOKEN`, or a token entered in the app. Entered tokens stay in server memory and are cleared on restart. They are not shared with the separate MCP process. MCP remote operations use that process's configured Git credentials. Browser OAuth and GitHub Enterprise are not implemented.

## Development and verification

```sh
npm ci
npm run build
npm test
npm run verify:package
```

The tests exercise real Git in temporary repositories, HTTP project selection, remote branch classification, commit details, GitHub API handling with mocks, online graph relationships, MCP negotiation and stale-action rejection. Package verification installs the archive in an isolated directory and starts its MCP server. CI runs on Windows and Linux with Node.js 22 and 24.

GitHub authentication and full sessions in every AI client cannot be proved by mocked or protocol-level tests. See [verification scope](integrations/VERIFICATION.md) for what has and has not been checked.

## Design and current limits

The React interface is bundled with Vite. The backend uses Node's standard library and invokes installed Git directly with argument arrays. HTTP binds to loopback, checks Host/Origin and requires a per-process token for API requests. MCP shares the Git implementation and serializes its requests.

- Local history is bounded to 180 commits; the recent list shows up to 40.
- Operation animations show intent, not a computed prediction of conflicts.
- Rebase and squash rewrite history. Squash supports recent linear unpublished commits and creates a backup branch.
- Individual processes serialize actions, but there is no cross-process lock against another editor or Git client.
- No arbitrary shell-command tool, force-push UI, packaged IDE extension or marketplace plugin is included.
- Tested locally on Windows; the CI matrix checks the supported Node versions on Windows and Linux. macOS has not been verified.

Bug reports should include the operation, Git/Node versions and a reproducible example. Remove tokens, private URLs and file contents before sharing logs.
