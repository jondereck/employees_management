import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const testsDir = join(root, "tests");

function collectTests(dir) {
  try {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) return collectTests(path);
      return /\.test\.ts$/.test(entry) ? [path] : [];
    });
  } catch {
    return [];
  }
}

const files = collectTests(testsDir);
if (!files.length) {
  console.log("No test files found.");
  process.exit(0);
}

const result = spawnSync("npx", ["tsx", "--test", ...files], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
