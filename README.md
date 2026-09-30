# Herdr Manager

A local control plane for all Copilot sessions running in Herdr. It gives a manager Copilot and the user the same view of:

- every open workspace and its working directory
- agent lifecycle state (`working`, `blocked`, `idle`, `done`, or `unknown`)
- the high-level task inferred from Herdr's terminal title
- projects with no active agent
- recent terminal output and basic focus, prompt, and close controls
- spawning a named Copilot session in a new tab of an existing workspace

## Run

Requirements: Node.js 20+ and a running Herdr server with the `herdr` CLI on `PATH`.

```powershell
npm start
```

Open `http://127.0.0.1:4317`. Set `PORT` or `HOST` to override the listener. The default loopback binding intentionally keeps the unauthenticated control API local.

The manager uses Herdr's CLI wrappers rather than directly opening the Windows named pipe. This follows Herdr's portability guidance and keeps protocol/version handling in the installed Herdr binary.

## Agent-facing API

The dashboard is backed by a small HTTP API that the manager Copilot can call directly:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service status |
| `GET` | `/api/snapshot` | Enriched workspace and agent inventory |
| `POST` | `/api/spawn` | Create a tab and start Copilot in an existing workspace |
| `POST` | `/api/agents/:paneId/prompt` | Send a prompt |
| `POST` | `/api/agents/:paneId/focus` | Focus the agent in Herdr |
| `GET` | `/api/agents/:paneId/output` | Read recent unwrapped terminal output as a normalized object with `text` |
| `DELETE` | `/api/tabs/:tabId` | Close a tab and its processes |

Spawn example:

```powershell
$body = @{
  workspaceId = "w2"
  name = "api-reviewer"
  tabLabel = "API review"
  task = "Review the API changes and report actionable issues."
  focus = $false
} | ConvertTo-Json

Invoke-RestMethod http://127.0.0.1:4317/api/spawn `
  -Method Post -ContentType application/json -Body $body
```

The spawn operation is transactional where possible: if Copilot cannot start in the newly created tab, the manager attempts to close that tab and returns the original Herdr error. If Copilot starts but the initial prompt fails, the session is preserved and the response includes `promptError`.

## Architecture

```text
Browser dashboard / manager Copilot
                 |
          localhost HTTP
                 |
       Node.js manager service
                 |
       herdr CLI JSON wrappers
                 |
        Herdr local socket API
```

The MVP polls `session.snapshot` every three seconds. Herdr documents snapshots as authoritative current state, which makes polling simple and resilient. A later version can use a long-lived `events.subscribe` connection as an invalidation signal, then reconcile through a fresh snapshot after events, reconnects, or `events_lost`.

## Safety

- The server binds to `127.0.0.1` by default and does not enable CORS.
- Herdr commands use argv execution without a shell.
- IDs and agent names are validated before invoking Herdr.
- Closing a tab requires browser confirmation.
- Spawn only targets a workspace that exists in the current authoritative snapshot.

## Validate

```powershell
npm run check
npm test
```
