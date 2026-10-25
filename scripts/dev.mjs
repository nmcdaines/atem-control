// Shared development runner. Own both process trees and stop the sibling if
// either server exits; Ctrl+C also cleans up compiler/npm child processes.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const children = [];
let stopping = false;

function port(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    throw new Error("Development ports must be integers between 1 and 65535.");
  }
  return number;
}
function available(number) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${number} is already in use. Choose API_PORT/UI_PORT or stop the existing server.`,
        ),
      ),
    );
    server.listen(number, "127.0.0.1", () => server.close(resolve));
  });
}
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid) continue;
    if (windows) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
  }
}
function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    detached: !windows,
    ...options,
  });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

try {
  const apiPort = port(process.env.CONTROL_API_PORT, 3847);
  const uiPort = port(process.env.CONTROL_UI_PORT, 1420);
  if (apiPort === uiPort)
    throw new Error("API_PORT and UI_PORT must be different.");
  await available(apiPort);
  await available(uiPort);
  start("cargo", [
    "run",
    "-p",
    "control-server",
    "--",
    "--demo",
    "--port",
    String(apiPort),
    "--database",
    process.env.CONTROL_DATABASE || resolve(root, ".local/control.sqlite3"),
  ]);
  let ready = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/snapshot`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        await response.arrayBuffer();
        ready = true;
        break;
      }
    } catch {
      /* Backend may still be compiling. */
    }
    await delay(100);
  }
  if (!stopping) {
    if (!ready)
      throw new Error(
        "The Rust backend did not become ready within two minutes.",
      );
    console.log(
      `\nATEM Control preview: http://127.0.0.1:${uiPort}\nPress Ctrl+C to stop both servers.\n`,
    );
    start(
      windows ? "npm.cmd" : "npm",
      ["run", "dev", "--", "--port", String(uiPort)],
      {
        cwd: resolve(root, "apps/desktop/ui"),
        env: {
          ...process.env,
          VITE_CONTROL_API: `http://127.0.0.1:${apiPort}`,
        },
        shell: windows,
      },
    );
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
