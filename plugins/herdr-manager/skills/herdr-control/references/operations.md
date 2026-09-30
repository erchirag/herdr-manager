# Herdr Manager operations

## Inventory

Run:

```powershell
$response = herdr api snapshot | ConvertFrom-Json
$snapshot = $response.result.snapshot
```

Join workspaces, tabs, panes, and agents by their IDs. Use `terminal_title_stripped` as the preferred task summary. A workspace is empty when no agent record has its `workspace_id`.

## Spawn Copilot in an existing workspace

```powershell
$created = herdr tab create --workspace <workspace-id> --cwd <absolute-cwd> --label <agent-name> --no-focus | ConvertFrom-Json
$paneId = $created.result.root_pane.pane_id
$tabId = $created.result.tab.tab_id
herdr agent start <agent-name> --kind copilot --pane $paneId --timeout 60000
herdr agent prompt <agent-name> "<task>"
```

The agent name must match `[a-z][a-z0-9_-]{0,31}` and be unique among live agents.

If `agent start` fails, close `$tabId`. If the later prompt fails, keep the running session and report the prompt failure.

## Coordinate

```powershell
herdr agent list
herdr agent get <target>
herdr agent prompt <target> "<task>" --wait --timeout 120000
herdr agent wait <target> --until blocked --timeout 120000
herdr agent read <target> --source recent-unwrapped --lines 120
herdr agent focus <target>
```

Default waits settle on idle, done, or blocked. `done` means completed but unseen; `idle` means ready and seen.

## Safety

- Read blocked output before asking the user for a decision.
- Do not answer approval prompts without user consent.
- Do not stop Herdr or kill its process.
- Do not close resources owned by the user or another agent unless explicitly requested.
