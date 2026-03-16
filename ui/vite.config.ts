import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const cliPackageJsonPath = path.resolve(__dirname, "../cli/package.json");
const upstreamRepoUrl = "https://github.com/paperclipai/paperclip.git";
const localPaperclipVersion = JSON.parse(fs.readFileSync(cliPackageJsonPath, "utf8")).version ?? "dev";

function parseStableTagVersion(tag: string): [number, number, number] | null {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a: [number, number, number], b: [number, number, number]) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function resolveUpstreamPaperclipVersion() {
  try {
    const output = execFileSync(
      "git",
      ["ls-remote", "--tags", "--refs", upstreamRepoUrl, "v*"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2_000,
      },
    );

    const versions = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("refs/tags/")[1] ?? "")
      .map((tag) => ({ tag, parsed: parseStableTagVersion(tag) }))
      .filter((entry): entry is { tag: string; parsed: [number, number, number] } => entry.parsed !== null)
      .sort((left, right) => compareVersions(right.parsed, left.parsed));

    return versions[0]?.tag.replace(/^v/, "") ?? localPaperclipVersion;
  } catch {
    return localPaperclipVersion;
  }
}

const paperclipVersion = resolveUpstreamPaperclipVersion();

export default defineConfig({
  define: {
    __PAPERCLIP_VERSION__: JSON.stringify(paperclipVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});
