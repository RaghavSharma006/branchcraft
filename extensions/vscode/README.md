# Branchcraft for VS Code and Cursor

Install the VSIX using **Extensions → Install from VSIX**, then open a local Git project. Run **Branchcraft: Open Local Repository** from the Command Palette. The branch icon opens the visual workspace in the activity-bar sidebar. **Branchcraft: Open Graph in Editor** gives the graph more room.

Requires Node.js 20+ and Git on PATH. Set **Branchcraft: Node Path** if Node is installed elsewhere. The extension bundles the frontend and local server; no build command or external service is needed. It starts its own loopback server on a free port and stops it when the extension unloads. No telemetry. Local folders only; remote SSH, WSL and virtual workspaces are not supported by this initial adapter.

**Branchcraft: Browse GitHub** opens public online history. To edit, clone/open the repository locally using the GUI. GitHub permissions and normal Git credentials still govern pushing.

Codex and Claude Code use the separate MCP integration. This extension does not add a custom sidebar to the Codex desktop app or Claude Code. Client tool permissions still apply.

This is a sideloadable alpha, not a marketplace listing. The packaged runtime and manifest can be tested automatically; full interactive editor verification requires a VS Code-compatible host.
