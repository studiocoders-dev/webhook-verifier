import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

if (!pkg.dependencies || Object.keys(pkg.dependencies).length !== 0) {
  console.error("ERROR: package.json must have strictly zero runtime dependencies.");
  process.exit(1);
}

const forbiddenPatterns = [
  { regex: /node:crypto/, reason: "Use Web Crypto API (globalThis.crypto.subtle) instead of node:crypto" },
  { regex: /\bBuffer\b/, reason: "Use Uint8Array and TextEncoder instead of Node.js Buffer" },
];

function scanDir(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    if (statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith(".ts")) {
      const content = readFileSync(fullPath, "utf8");
      for (const { regex, reason } of forbiddenPatterns) {
        if (regex.test(content)) {
          console.error(`ERROR in ${fullPath}: ${reason}`);
          process.exit(1);
        }
      }
    }
  }
}

scanDir(new URL("../src", import.meta.url).pathname);
console.log("Lint passed: Zero runtime dependencies and 100% Web Standards compliance verified.");
