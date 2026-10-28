# Connect Branchcraft to an AI client

Requires local Node.js20+ and Git. Install the supplied archive with `npm install -g /path/to/branchcraft-0.2.0.tgz`, or use `node /path/to/branchcraft/bin/branchcraft.mjs` from source. The archive includes the built GUI and has zero npm runtime dependencies. It is not published to npm or any marketplace.

Generate settings for the repository you want the agent to control:

```
branchcraft --connect codex /absolute/path/to/repo
branchcraft --connect claude /absolute/path/to/repo
branchcraft --connect cursor /absolute/path/to/repo
branchcraft --connect generic /absolute/path/to/repo
```

These commands only print configuration. They validate the repository and use absolute Node and launcher paths, including correct escaping for Windows paths and spaces. Generate settings again if the installation moves. For multiple repositories, use a distinct server key for each.

- Codex: merge the printed TOML table into your Codex config.toml (normally ~/.codex/config.toml).
- Claude Code: merge the printed branchcraft entry into the project's .mcp.json under mcpServers.
- Cursor: merge the printed branchcraft entry into the project's .cursor/mcp.json under mcpServers.
- Other local MCP clients: use the generic command/args entry in their stdio MCP settings. Cloud-only clients cannot run your local Node process.

Preserve existing entries. Restart/reconnect the client and accept its normal workspace/server trust prompt. Ask: "Use Branchcraft to show this repository's branches and working changes." Verify git_status returns the expected path. Read-only inspection needs no GitHub account. Mutations use the same real Git engine as the GUI; the client controls tool approval. Each MCP process is fixed to one repository.

## Optional skill
Copy the entire skills/branchcraft folder into a supported skill location: ~/.agents/skills for Codex, ~/.claude/skills for Claude Code, or .cursor/skills in a Cursor project. It supplements the MCP tools; it does not replace server configuration. Other clients can use SKILL.md as project instructions if they lack skill support. The skill guides status/diff checks, intended-file commits, stale HEAD handling, conflicts and recovery.

## Tools
- git_status: branches, commits, working changes and operation state.
- git_diff: selected commit or file diff.
- git_recovery: reflog entries.
- git_action: commit, branch, switch, merge, rebase, cherry-pick, revert, stash, tag, squash, bisect, resolve, continue, abort, fetch/pull/push. Requires fresh expectedHead.

No arbitrary shell command or force-push interface. No HTTP port or browser session token is needed for MCP. GUI-entered GitHub credentials are not inherited by MCP; Git uses its configured credentials. Separate processes and external editors can still race; use fresh status and avoid concurrent mutations.

Configuration references: [Codex](https://developers.openai.com/codex/mcp), [Claude Code](https://code.claude.com/docs/en/mcp), [Cursor](https://cursor.com/docs/mcp).
