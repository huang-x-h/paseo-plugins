import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import { repositoriesRpc } from "../shared/repositories";
import { git } from "./diff";

const SKIP = new Set([".git", "node_modules", ".venv", "venv", "vendor", "dist", "build", "target", ".next", ".cache"]);
const MAX_DIRS = 2500;
const MAX_REPOS = 60;
const MAX_DEPTH = 4;
const MAX_SUGGESTION_LEVELS = 3;

async function repoRoot(directory: string) {
  return (await git(directory, ["rev-parse", "--show-toplevel"])).trim();
}

async function summary(directory: string) {
  const result = { directory, branch: "", staged: 0, unstaged: 0, untracked: 0, conflicts: 0, ahead: 0, behind: 0, upstream: "", lastCommit: "", error: "" };
  try {
    const [status, lastCommit] = await Promise.all([
      git(directory, ["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"]),
      git(directory, ["log", "-1", "--format=%h %s"]).catch(() => ""),
    ]);
    result.lastCommit = lastCommit.trim();
    const entries = status.split("\0");
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      if (item.startsWith("# branch.head ")) result.branch = item.slice(14);
      else if (item.startsWith("# branch.upstream ")) result.upstream = item.slice(18);
      else if (item.startsWith("# branch.ab ")) {
        const match = item.match(/\+(\d+) -(\d+)/);
        if (match) { result.ahead = Number(match[1]); result.behind = Number(match[2]); }
      } else if (item.startsWith("? ")) result.untracked++;
      else if (item.startsWith("u ")) result.conflicts++;
      else if (item.startsWith("1 ") || item.startsWith("2 ")) {
        if (item[2] !== ".") result.staged++;
        if (item[3] !== ".") result.unstaged++;
        if (item.startsWith("2 ")) i++; // Renames carry an extra NUL-delimited original path.
      }
    }
    if (result.branch === "(detached)") result.branch = `(detached) ${lastCommit.trim().split(" ")[0] || "HEAD"}`;
  } catch (error) { result.error = error instanceof Error ? error.message : String(error); }
  return result;
}

// Counts child directories of a parent that look like repositories, without running git.
async function countChildRepositories(parent: string) {
  let count = 0;
  try {
    const entries = await readdir(parent, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
      try {
        const marker = await lstat(path.join(parent, entry.name, ".git"));
        if (marker) count++;
      } catch { /* not a repository */ }
    }
  } catch { /* unreadable directory */ }
  return count;
}

export async function getRepositories({ directory, roots }: RpcInput<typeof repositoriesRpc>) {
  const found = new Map<string, string>();
  const warnings: string[] = [];
  const scannedRoots: string[] = [];
  let truncated = false;
  const add = async (candidate: string, report: boolean) => {
    try {
      const root = await realpath(await repoRoot(candidate));
      const key = process.platform === "win32" ? root.toLowerCase() : root;
      if (!found.has(key)) {
        if (found.size >= MAX_REPOS) truncated = true;
        else found.set(key, root);
      }
    } catch (error) {
      if (report) warnings.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const scanTree = async (root: string, maxDepth: number) => {
    scannedRoots.push(root);
    const queue = [{ directory: root, depth: 0 }];
    let visited = 0;
    while (queue.length && visited < MAX_DIRS && found.size < MAX_REPOS) {
      const current = queue.shift()!;
      visited++;
      try {
        const entries = await readdir(current.directory, { withFileTypes: true });
        if (entries.some((entry) => entry.name === ".git")) await add(current.directory, true);
        if (current.depth < maxDepth) for (const entry of entries) {
          if (entry.isDirectory() && !entry.isSymbolicLink() && !SKIP.has(entry.name)) queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
        }
      } catch (error) { warnings.push(`${current.directory}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    if (queue.length) truncated = true;
  };
  // Include the enclosing repository when the workspace starts below its root.
  await add(directory, false);
  await scanTree(directory, MAX_DEPTH);
  // Extra roots come from an explicit user choice in the client.
  for (const root of roots) {
    if (!path.isAbsolute(root)) { warnings.push(`${root}: 请提供绝对路径`); continue; }
    await add(root, true);
    await scanTree(root, 1);
  }
  const repositories = await Promise.all([...found.values()].map(summary));
  repositories.sort((a, b) => a.directory.localeCompare(b.directory));
  // Offer parent directories as suggestions instead of scanning them silently.
  const suggestions: { directory: string; repositoryCount: number }[] = [];
  if (repositories.length === 0) {
    let parent = path.dirname(directory);
    for (let level = 0; level < MAX_SUGGESTION_LEVELS; level++) {
      if (!parent || parent === path.parse(parent).root) break;
      const count = await countChildRepositories(parent);
      if (count > 0) suggestions.push({ directory: parent, repositoryCount: count });
      parent = path.dirname(parent);
    }
  }
  return { repositories, truncated, warnings: warnings.slice(0, 50), scannedRoots, suggestions };
}
