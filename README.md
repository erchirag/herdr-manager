# Herdr Manager Agent

Herdr Manager is an installable custom agent for GitHub Copilot CLI. It turns one Copilot session into the conversational control plane for every coding agent running in the current Herdr session.

There is no web dashboard or background service. Select the custom agent and talk to it directly:

```text
Show me every workspace and what each agent is doing.
Start a Copilot in the api workspace and ask it to review authentication.
Which projects are empty?
Wait for the reviewer and summarize its result.
Focus the agent that is blocked.
```

The manager uses the installed `herdr` CLI, which is Herdr's portable wrapper over its local socket API.

## Install in GitHub Copilot CLI

Add this repository as a marketplace:

```powershell
copilot plugin marketplace add erchirag/herdr-manager
copilot plugin install herdr-manager@herdr-manager-marketplace
```

Start Copilot with the manager as the primary agent:

```powershell
copilot --agent "herdr-manager:herdr-manager"
```

In an existing interactive session, run `/agent`, select **herdr-manager:herdr-manager**, and then send your request. Restart Copilot after the first installation so the agent is discovered.

For local development, register the repository as a local marketplace:

```powershell
copilot plugin marketplace add .
copilot plugin install herdr-manager@herdr-manager-marketplace
```

Local marketplace plugins load live from the repository. Edits take effect in the next Copilot session without reinstalling.

## Requirements

- A running Herdr server.
- The manager Copilot session must be launched inside a Herdr-managed pane, with `HERDR_ENV=1`.
- The `herdr` executable must be available on `PATH`.
- Copilot must already be authenticated if the manager will start Copilot agents.

## What the agent does

- Builds an authoritative inventory from `herdr api snapshot`.
- Reports workspace, tab, pane, cwd, focused state, agent type, lifecycle state, and high-level task title.
- Calls out empty workspaces and agents that are blocked, working, done, idle, or unknown.
- Creates a new tab in an existing workspace and starts a named Copilot session.
- Sends prompts, waits for lifecycle changes, reads recent output, focuses sessions, and coordinates multiple agents.
- Preserves user focus for background work unless explicitly asked otherwise.
- Requires explicit confirmation before destructive operations or answering an agent's approval prompt.

## Repository layout

```text
.github/plugin/marketplace.json             Copilot marketplace catalog
plugins/herdr-manager/plugin.json           Agent Plugins 1.0 manifest
plugins/herdr-manager/com.github.copilot/    Copilot custom agent
plugins/herdr-manager/skills/                Portable Herdr control skill
```

## Validate

```powershell
npm run check
```

You can also test discovery without using the hosted marketplace:

```powershell
copilot plugin marketplace add .
copilot plugin install herdr-manager@herdr-manager-marketplace
copilot plugin list
```

## Safety model

The manager never predicts Herdr IDs, relies on another client's focused pane, or closes resources implicitly. It parses IDs from Herdr's JSON responses, uses `--no-focus` for background creation, and inspects blocked agent output before requesting a decision.
