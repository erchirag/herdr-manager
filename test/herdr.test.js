import assert from "node:assert/strict";
import test from "node:test";
import { createHerdrClient } from "../src/herdr.js";

test("readAgent unwraps Herdr pane_read responses", async () => {
  const execute = async () => ({
    stdout: JSON.stringify({
      id: "cli:agent:read",
      result: {
        type: "pane_read",
        read: {
          pane_id: "w1:p1",
          workspace_id: "w1",
          tab_id: "w1:t1",
          source: "recent_unwrapped",
          format: "text",
          text: "Agent terminal output",
          revision: 12,
          truncated: false,
        },
      },
    }),
    stderr: "",
  });

  const client = createHerdrClient({ execute });
  const result = await client.readAgent("w1:p1");

  assert.equal(result.text, "Agent terminal output");
  assert.equal(result.pane_id, "w1:p1");
});
