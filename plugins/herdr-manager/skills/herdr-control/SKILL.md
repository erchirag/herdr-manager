---
name: herdr-control
description: Inspect and control Herdr workspaces, tabs, panes, and coding agents. Use when managing Herdr sessions, spawning Copilot agents, checking agent status, coordinating work, or finding empty projects.
---

# Herdr control

Use the installed `herdr` CLI as the portable interface to Herdr's local socket API.

1. Require `HERDR_ENV=1`.
2. Run `herdr --skill` once to load version-matched guidance.
3. Use `herdr api snapshot` for authoritative topology and agent state.
4. Parse IDs from JSON responses.
5. Use explicit IDs or unique agent names, never global focus.
6. Use `--no-focus` for background creation.
7. Inspect blocked output and obtain user direction before sending input.
8. Never close resources you did not create without an explicit request.

For detailed operating procedures, read [references/operations.md](references/operations.md).
