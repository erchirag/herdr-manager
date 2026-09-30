const VALID_ID = /^[a-zA-Z0-9:_-]+$/;
const VALID_AGENT_NAME = /^[a-z][a-z0-9_-]{0,31}$/;

export function assertId(value, label) {
  if (typeof value !== "string" || !VALID_ID.test(value)) {
    const error = new Error(`${label} is invalid.`);
    error.code = "invalid_request";
    throw error;
  }
  return value;
}

export function makeAgentName(value) {
  if (value !== undefined && value !== "") {
    if (typeof value !== "string" || !VALID_AGENT_NAME.test(value)) {
      const error = new Error(
        "Agent name must start with a lowercase letter and contain at most 32 lowercase letters, numbers, underscores, or hyphens.",
      );
      error.code = "invalid_request";
      throw error;
    }
    return value;
  }

  const suffix = Math.random().toString(36).slice(2, 7);
  return `mgr-${Date.now().toString(36)}-${suffix}`.slice(0, 32);
}

export function requireText(value, label, maxLength = 20000) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${label} is required.`);
    error.code = "invalid_request";
    throw error;
  }
  if (value.length > maxLength) {
    const error = new Error(`${label} must be ${maxLength} characters or fewer.`);
    error.code = "invalid_request";
    throw error;
  }
  return value.trim();
}

export function optionalText(value, label, maxLength = 20000) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  if (typeof value !== "string") {
    const error = new Error(`${label} must be text.`);
    error.code = "invalid_request";
    throw error;
  }
  if (value.length > maxLength) {
    const error = new Error(`${label} must be ${maxLength} characters or fewer.`);
    error.code = "invalid_request";
    throw error;
  }
  return value.trim();
}

export function buildManagerView(snapshot) {
  const panes = snapshot.panes ?? [];
  const tabs = snapshot.tabs ?? [];
  const agents = snapshot.agents ?? [];

  return {
    version: snapshot.version,
    protocol: snapshot.protocol,
    focusedWorkspaceId: snapshot.focused_workspace_id,
    focusedAgentCount: agents.filter((agent) => agent.focused).length,
    counts: {
      workspaces: snapshot.workspaces?.length ?? 0,
      agents: agents.length,
      working: agents.filter((agent) => agent.agent_status === "working").length,
      blocked: agents.filter((agent) => agent.agent_status === "blocked").length,
      empty: (snapshot.workspaces ?? []).filter(
        (workspace) => !agents.some((agent) => agent.workspace_id === workspace.workspace_id),
      ).length,
    },
    workspaces: (snapshot.workspaces ?? []).map((workspace) => {
      const workspacePanes = panes.filter(
        (pane) => pane.workspace_id === workspace.workspace_id,
      );
      const workspaceAgents = agents.filter(
        (agent) => agent.workspace_id === workspace.workspace_id,
      );
      const workspaceTabs = tabs.filter(
        (tab) => tab.workspace_id === workspace.workspace_id,
      );
      const cwd =
        workspaceAgents.find((agent) => agent.foreground_cwd || agent.cwd)
          ?.foreground_cwd ??
        workspaceAgents.find((agent) => agent.cwd)?.cwd ??
        workspacePanes.find((pane) => pane.foreground_cwd || pane.cwd)
          ?.foreground_cwd ??
        workspacePanes.find((pane) => pane.cwd)?.cwd ??
        null;

      return {
        ...workspace,
        cwd,
        empty: workspaceAgents.length === 0,
        tabs: workspaceTabs,
        agents: workspaceAgents.map((agent) => ({
          ...agent,
          summary:
            agent.terminal_title_stripped ||
            agent.terminal_title ||
            `${agent.agent} session`,
          tabLabel:
            workspaceTabs.find((tab) => tab.tab_id === agent.tab_id)?.label ?? null,
        })),
      };
    }),
  };
}
