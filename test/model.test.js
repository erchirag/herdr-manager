import assert from "node:assert/strict";
import test from "node:test";
import { buildManagerView, makeAgentName, optionalText } from "../src/model.js";

test("buildManagerView identifies empty workspaces and summarizes agents", () => {
  const view = buildManagerView({
    version: "0.8.2",
    workspaces: [
      { workspace_id: "w1", label: "api" },
      { workspace_id: "w2", label: "web" },
    ],
    tabs: [{ workspace_id: "w1", tab_id: "w1:t1", label: "main" }],
    panes: [
      { workspace_id: "w1", pane_id: "w1:p1", cwd: "C:\\api" },
      { workspace_id: "w2", pane_id: "w2:p1", cwd: "C:\\web" },
    ],
    agents: [
      {
        workspace_id: "w1",
        tab_id: "w1:t1",
        pane_id: "w1:p1",
        agent: "copilot",
        agent_status: "working",
        terminal_title_stripped: "Implement auth",
      },
    ],
  });

  assert.deepEqual(view.counts, {
    workspaces: 2,
    agents: 1,
    working: 1,
    blocked: 0,
    empty: 1,
  });
  assert.equal(view.workspaces[0].cwd, "C:\\api");
  assert.equal(view.workspaces[0].agents[0].summary, "Implement auth");
  assert.equal(view.workspaces[1].empty, true);
});

test("makeAgentName validates explicit names", () => {
  assert.equal(makeAgentName("api-reviewer"), "api-reviewer");
  assert.throws(() => makeAgentName("API Reviewer"), /must start/);
});

test("optionalText rejects non-string API values", () => {
  assert.equal(optionalText(undefined, "task"), "");
  assert.equal(optionalText("  review this  ", "task"), "review this");
  assert.throws(() => optionalText(42, "task"), /must be text/);
});
