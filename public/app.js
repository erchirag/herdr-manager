const state = {
  view: null,
  busy: false,
  timer: null,
};

const elements = {
  connectionDot: document.querySelector("#connectionDot"),
  connectionText: document.querySelector("#connectionText"),
  lastUpdated: document.querySelector("#lastUpdated"),
  outputContent: document.querySelector("#outputContent"),
  outputDialog: document.querySelector("#outputDialog"),
  outputTitle: document.querySelector("#outputTitle"),
  refreshButton: document.querySelector("#refreshButton"),
  spawnDialog: document.querySelector("#spawnDialog"),
  spawnError: document.querySelector("#spawnError"),
  spawnForm: document.querySelector("#spawnForm"),
  spawnSubmit: document.querySelector("#spawnSubmit"),
  spawnTopButton: document.querySelector("#spawnTopButton"),
  spawnWorkspace: document.querySelector("#spawnWorkspace"),
  stats: document.querySelector("#stats"),
  toast: document.querySelector("#toast"),
  workspaceGrid: document.querySelector("#workspaceGrid"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || `Request failed (${response.status})`);
  }
  return body;
}

function showToast(message, error = false) {
  elements.toast.textContent = message;
  elements.toast.className = `toast show${error ? " error" : ""}`;
  window.setTimeout(() => {
    elements.toast.className = "toast";
  }, 3200);
}

function setConnection(online, text) {
  elements.connectionDot.className = `connection-dot ${online ? "online" : "offline"}`;
  elements.connectionText.textContent = text;
}

function renderStats(counts) {
  const stats = [
    ["Workspaces", counts.workspaces],
    ["Agents", counts.agents],
    ["Working", counts.working],
    ["Blocked", counts.blocked],
    ["Empty projects", counts.empty],
  ];
  elements.stats.innerHTML = stats
    .map(
      ([label, value]) =>
        `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`,
    )
    .join("");
}

function renderAgent(agent) {
  const target = escapeHtml(agent.pane_id);
  const name = escapeHtml(agent.agent);
  const status = escapeHtml(agent.agent_status || "unknown");
  return `
    <article class="agent-card">
      <div class="agent-head">
        <div>
          <h3>${name}</h3>
          <div class="agent-meta">${escapeHtml(agent.tabLabel || agent.tab_id)} · ${target}</div>
        </div>
        <span class="status status-${status}">${status}</span>
      </div>
      <p class="agent-summary">${escapeHtml(agent.summary)}</p>
      <div class="agent-actions">
        <button class="ghost-button" data-action="focus" data-target="${target}">Focus</button>
        <button class="ghost-button" data-action="output" data-target="${target}" data-title="${escapeHtml(agent.summary)}">Output</button>
        <button class="ghost-button" data-action="prompt" data-target="${target}">Prompt</button>
        <button class="danger-button" data-action="close" data-tab="${escapeHtml(agent.tab_id)}">Close tab</button>
      </div>
    </article>
  `;
}

function renderWorkspace(workspace) {
  const agents = workspace.agents.length
    ? workspace.agents.map(renderAgent).join("")
    : `
      <div class="empty-state">
        <strong>No agent is running here</strong>
        This project is ready for a new Copilot session.
      </div>
    `;
  return `
    <article class="workspace-card${workspace.empty ? " empty" : ""}">
      <header class="workspace-head">
        <div class="workspace-title">
          <h3>${escapeHtml(workspace.label || workspace.workspace_id)}</h3>
          <div class="workspace-meta">${escapeHtml(workspace.cwd || "Working directory unavailable")}</div>
        </div>
        <div>
          <div class="workspace-number">#${escapeHtml(workspace.number)}</div>
          <button class="ghost-button" data-action="spawn" data-workspace="${escapeHtml(workspace.workspace_id)}">+ Copilot</button>
        </div>
      </header>
      <div class="agent-list">${agents}</div>
    </article>
  `;
}

function render(view) {
  state.view = view;
  renderStats(view.counts);
  elements.workspaceGrid.innerHTML =
    view.workspaces.map(renderWorkspace).join("") ||
    '<div class="loading-card">No Herdr workspaces are open.</div>';
  elements.spawnWorkspace.innerHTML = view.workspaces
    .map(
      (workspace) =>
        `<option value="${escapeHtml(workspace.workspace_id)}">${escapeHtml(workspace.label || workspace.workspace_id)} — ${escapeHtml(workspace.cwd || "cwd unavailable")}</option>`,
    )
    .join("");
  elements.spawnTopButton.disabled = view.workspaces.length === 0;
  elements.lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()} · Herdr ${view.version || "unknown"}`;
  setConnection(true, "Herdr online");
}

async function refresh({ quiet = false } = {}) {
  if (state.busy) return;
  try {
    render(await api("/api/snapshot"));
  } catch (error) {
    setConnection(false, "Herdr unavailable");
    elements.lastUpdated.textContent = error.message;
    if (!quiet) showToast(error.message, true);
  }
}

function openSpawn(workspaceId) {
  elements.spawnError.textContent = "";
  elements.spawnForm.reset();
  if (workspaceId) elements.spawnWorkspace.value = workspaceId;
  elements.spawnDialog.showModal();
}

async function withBusy(callback) {
  state.busy = true;
  try {
    return await callback();
  } finally {
    state.busy = false;
  }
}

elements.spawnForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.spawnError.textContent = "";
  elements.spawnSubmit.disabled = true;
  elements.spawnSubmit.textContent = "Starting Copilot…";
  const data = Object.fromEntries(new FormData(elements.spawnForm));
  data.focus = new FormData(elements.spawnForm).has("focus");
  try {
    const result = await withBusy(() =>
      api("/api/spawn", { method: "POST", body: JSON.stringify(data) }),
    );
    elements.spawnDialog.close();
    showToast(
      result.promptError
        ? `Copilot started, but the prompt failed: ${result.promptError.message}`
        : "Copilot session started.",
      Boolean(result.promptError),
    );
    await refresh();
  } catch (error) {
    elements.spawnError.textContent = error.message;
  } finally {
    elements.spawnSubmit.disabled = false;
    elements.spawnSubmit.textContent = "Spawn session";
  }
});

elements.workspaceGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "spawn") {
    openSpawn(button.dataset.workspace);
    return;
  }
  if (action === "prompt") {
    const text = window.prompt("Prompt this Copilot session:");
    if (!text?.trim()) return;
    button.disabled = true;
    try {
      await withBusy(() =>
        api(`/api/agents/${encodeURIComponent(button.dataset.target)}/prompt`, {
          method: "POST",
          body: JSON.stringify({ text }),
        }),
      );
      showToast("Prompt sent.");
      await refresh();
    } catch (error) {
      showToast(error.message, true);
    } finally {
      button.disabled = false;
    }
    return;
  }
  if (action === "focus") {
    try {
      await api(`/api/agents/${encodeURIComponent(button.dataset.target)}/focus`, {
        method: "POST",
      });
      showToast("Agent focused in Herdr.");
      await refresh();
    } catch (error) {
      showToast(error.message, true);
    }
    return;
  }
  if (action === "output") {
    elements.outputTitle.textContent = button.dataset.title || "Agent output";
    elements.outputContent.textContent = "Loading…";
    elements.outputDialog.showModal();
    try {
      const result = await api(
        `/api/agents/${encodeURIComponent(button.dataset.target)}/output`,
      );
      elements.outputContent.textContent =
        result.text ??
        result.read?.text ??
        result.output ??
        "No terminal output is available.";
    } catch (error) {
      elements.outputContent.textContent = error.message;
    }
    return;
  }
  if (action === "close") {
    if (!window.confirm("Close this entire Herdr tab and its running process?")) return;
    try {
      await withBusy(() =>
        api(`/api/tabs/${encodeURIComponent(button.dataset.tab)}`, {
          method: "DELETE",
        }),
      );
      showToast("Tab closed.");
      await refresh();
    } catch (error) {
      showToast(error.message, true);
    }
  }
});

elements.refreshButton.addEventListener("click", () => refresh());
elements.spawnTopButton.addEventListener("click", () => openSpawn());
document.querySelectorAll(".close-dialog").forEach((button) =>
  button.addEventListener("click", () => elements.spawnDialog.close()),
);
document.querySelectorAll(".close-output").forEach((button) =>
  button.addEventListener("click", () => elements.outputDialog.close()),
);

refresh();
state.timer = window.setInterval(() => refresh({ quiet: true }), 3000);
