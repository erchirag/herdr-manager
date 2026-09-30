import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHerdrClient, HerdrError } from "./herdr.js";
import {
  assertId,
  buildManagerView,
  makeAgentName,
  optionalText,
  requireText,
} from "./model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const client = createHerdrClient();
const port = Number.parseInt(process.env.PORT || "4317", 10);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Request body is too large.");
      error.code = "invalid_request";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.code = "invalid_request";
    throw error;
  }
}

async function getView() {
  return buildManagerView(await client.snapshot());
}

async function spawnAgent(body) {
  const workspaceId = assertId(body.workspaceId, "workspaceId");
  const name = makeAgentName(body.name);
  const requestedCwd = optionalText(body.cwd, "cwd", 1000);
  const tabLabel = optionalText(body.tabLabel, "tabLabel", 80);
  const task = optionalText(body.task, "task");
  const view = await getView();
  const workspace = view.workspaces.find(
    (item) => item.workspace_id === workspaceId,
  );
  if (!workspace) {
    const error = new Error("Workspace was not found.");
    error.code = "not_found";
    throw error;
  }

  const cwd = requestedCwd || workspace.cwd;
  if (!cwd) {
    const error = new Error("No working directory is available for this workspace.");
    error.code = "invalid_request";
    throw error;
  }

  const tabResult = await client.createTab({
    workspaceId,
    cwd,
    label: tabLabel || name,
    focus: Boolean(body.focus),
  });
  const tab = tabResult.tab;
  const rootPane = tabResult.root_pane;
  if (!tab?.tab_id || !rootPane?.pane_id) {
    throw new HerdrError("Herdr did not return the created tab and root pane.", {
      code: "invalid_response",
      details: tabResult,
    });
  }

  let agent;
  try {
    agent = await client.startAgent({
      paneId: rootPane.pane_id,
      name,
      kind: "copilot",
    });
  } catch (error) {
    try {
      await client.closeTab(tab.tab_id);
    } catch {
      // Preserve the original startup error; the orphan tab remains visible.
    }
    throw error;
  }

  let prompt = null;
  let promptError = null;
  if (task) {
    try {
      prompt = await client.promptAgent(name, task);
    } catch (error) {
      promptError = {
        code: error.code || "prompt_failed",
        message: error.message || "Copilot started, but the initial prompt failed.",
      };
    }
  }

  return { name, tab, pane: rootPane, agent, prompt, promptError };
}

async function serveStatic(request, response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(publicDir, relativePath);
  if (!filePath.startsWith(`${publicDir}${path.sep}`) && filePath !== publicDir) {
    sendJson(response, 404, { error: { code: "not_found", message: "Not found." } });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: { code: "not_found", message: "Not found." } });
  }
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "herdr-manager",
      herdrEnvironment: process.env.HERDR_ENV === "1",
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/snapshot") {
    sendJson(response, 200, await getView());
    return;
  }

  if (request.method === "POST" && pathname === "/api/spawn") {
    sendJson(response, 201, await spawnAgent(await readJson(request)));
    return;
  }

  const outputMatch = pathname.match(/^\/api\/agents\/([^/]+)\/output$/);
  if (request.method === "GET" && outputMatch) {
    const target = assertId(decodeURIComponent(outputMatch[1]), "agent target");
    const result = await client.readAgent(target);
    sendJson(response, 200, result);
    return;
  }

  const actionMatch = pathname.match(
    /^\/api\/agents\/([^/]+)\/(prompt|focus)$/,
  );
  if (request.method === "POST" && actionMatch) {
    const target = assertId(decodeURIComponent(actionMatch[1]), "agent target");
    if (actionMatch[2] === "focus") {
      sendJson(response, 200, await client.focusAgent(target));
      return;
    }
    const body = await readJson(request);
    const text = requireText(body.text, "text");
    sendJson(response, 200, await client.promptAgent(target, text));
    return;
  }

  const tabMatch = pathname.match(/^\/api\/tabs\/([^/]+)$/);
  if (request.method === "DELETE" && tabMatch) {
    const tabId = assertId(decodeURIComponent(tabMatch[1]), "tabId");
    sendJson(response, 200, await client.closeTab(tabId));
    return;
  }

  sendJson(response, 404, {
    error: { code: "not_found", message: "API route not found." },
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
    } else {
      await serveStatic(request, response, url.pathname);
    }
  } catch (error) {
    const status =
      error.code === "invalid_request"
        ? 400
        : error.code === "not_found"
          ? 404
          : error.code === "agent_blocked"
            ? 409
            : 502;
    sendJson(response, status, {
      error: {
        code: error.code || "internal_error",
        message: error.message || "Unexpected error.",
        details: error instanceof HerdrError ? error.details : undefined,
      },
    });
  }
});

server.listen(port, host, () => {
  console.log(`Herdr Manager listening at http://${host}:${port}`);
});
