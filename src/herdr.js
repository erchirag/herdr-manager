import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class HerdrError extends Error {
  constructor(message, { code = "herdr_error", details, command } = {}) {
    super(message);
    this.name = "HerdrError";
    this.code = code;
    this.details = details;
    this.command = command;
  }
}

function parseJsonOutput(output, command) {
  const text = output.trim();
  if (!text) {
    throw new HerdrError("Herdr returned an empty response.", { command });
  }

  try {
    const envelope = JSON.parse(text);
    if (envelope.error) {
      throw new HerdrError(envelope.error.message || "Herdr request failed.", {
        code: envelope.error.code,
        details: envelope.error,
        command,
      });
    }
    return envelope.result ?? envelope;
  } catch (error) {
    if (error instanceof HerdrError) {
      throw error;
    }
    throw new HerdrError("Herdr returned invalid JSON.", {
      details: text.slice(0, 1000),
      command,
    });
  }
}

function parseCliError(error, command) {
  const stderr = String(error.stderr || "").trim();
  if (stderr) {
    try {
      const envelope = JSON.parse(stderr);
      const apiError = envelope.error ?? envelope;
      return new HerdrError(apiError.message || "Herdr command failed.", {
        code: apiError.code,
        details: apiError,
        command,
      });
    } catch (parseError) {
      if (parseError instanceof HerdrError) {
        return parseError;
      }
    }
  }

  return new HerdrError(error.message || "Herdr command failed.", {
    code: error.code,
    details: stderr || String(error.stdout || "").trim(),
    command,
  });
}

export function createHerdrClient({ binary = "herdr", execute = execFileAsync } = {}) {
  async function run(args, { timeout = 15000 } = {}) {
    const command = [binary, ...args];
    try {
      const { stdout } = await execute(binary, args, {
        encoding: "utf8",
        timeout,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      });
      return parseJsonOutput(stdout, command);
    } catch (error) {
      if (error instanceof HerdrError) {
        throw error;
      }
      throw parseCliError(error, command);
    }
  }

  return {
    run,

    async snapshot() {
      const result = await run(["api", "snapshot"]);
      return result.snapshot ?? result;
    },

    async createTab({ workspaceId, cwd, label, focus = false }) {
      const args = ["tab", "create", "--workspace", workspaceId];
      if (cwd) args.push("--cwd", cwd);
      if (label) args.push("--label", label);
      args.push(focus ? "--focus" : "--no-focus");
      return run(args);
    },

    async startAgent({ paneId, name, kind = "copilot" }) {
      return run(
        ["agent", "start", name, "--kind", kind, "--pane", paneId, "--timeout", "60000"],
        { timeout: 70000 },
      );
    },

    async promptAgent(target, text) {
      return run(["agent", "prompt", target, text], { timeout: 30000 });
    },

    async focusAgent(target) {
      return run(["agent", "focus", target]);
    },

    async readAgent(target, lines = 100) {
      const result = await run([
        "agent",
        "read",
        target,
        "--source",
        "recent-unwrapped",
        "--lines",
        String(lines),
      ]);
      return result.read ?? result;
    },

    async closeTab(tabId) {
      return run(["tab", "close", tabId]);
    },
  };
}
