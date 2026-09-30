import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  ".github/plugin/marketplace.json",
  "plugins/herdr-manager/plugin.json",
  "plugins/herdr-manager/com.github.copilot/agents/herdr-manager.agent.md",
  "plugins/herdr-manager/skills/herdr-control/SKILL.md",
];

for (const relativePath of requiredFiles) {
  await access(path.join(root, relativePath));
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const copilotMarketplace = await readJson(".github/plugin/marketplace.json");
const agentPlugin = await readJson("plugins/herdr-manager/plugin.json");

assert.equal(copilotMarketplace.name, "herdr-manager-marketplace");
assert.equal(copilotMarketplace.plugins.length, 1);
assert.equal(copilotMarketplace.plugins[0].name, "herdr-manager");
assert.equal(
  copilotMarketplace.plugins[0].source,
  "./plugins/herdr-manager",
);

assert.equal(agentPlugin.name, "herdr-manager");
assert.equal(
  agentPlugin.$schema,
  "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
);
const copilotAgent = await readFile(
  path.join(
    root,
    "plugins/herdr-manager/com.github.copilot/agents/herdr-manager.agent.md",
  ),
  "utf8",
);
assert.match(copilotAgent, /^---\r?\nname: herdr-manager/m);
assert.match(copilotAgent, /herdr api snapshot/);
assert.match(copilotAgent, /herdr agent start/);

console.log("Herdr Manager plugin and marketplace structure is valid.");
