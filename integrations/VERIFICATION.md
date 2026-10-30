# Verification scope

Release checks cover production compilation, real Git workflows in disposable repositories, local HTTP routing and project mismatch protection, mocked GitHub responses, online input validation and graph parent relationships, MCP stdio negotiation/status/stale-head rejection, and installation of the built archive without runtime dependencies.

The package smoke check starts the installed MCP server, reads its tools and repository status, and validates generated client configuration. A successful protocol test is not a claim that an interactive Codex, Claude Code or Cursor session was tested.

Local and public GitHub UI flows have been manually inspected in the browser. Private GitHub account/clone/PR flows need a test account and remain unverified end to end. macOS, every Git edge case and cross-process mutation races are not covered. Public API availability and rate limits can change independently of a passing build.

CI runs the build, tests and installed-package checks on Windows/Linux with Node22/24. Consult the actual Actions results for the release commit; the presence of a workflow file alone does not mean it passed.

The editor adapter test uses a simulated VS Code API but launches the real Git HTTP server. It verifies workspace trust, selected-repository arguments, authenticated state, asset delivery and process shutdown. This does not verify iframe rendering or interactions in an actual VS Code/Cursor host; those remain unverified. The VSIX is a sideloadable alpha.
