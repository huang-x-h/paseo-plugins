import { readdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import { repositoriesRpc } from "../shared/repositories";
import { git } from "./diff";

const SKIP = new Set([".git", "node_modules", ".venv", "venv", "vendor", "dist", "build", "target", ".next", ".cache"]);
const MAX_DIRS = 2500;
const MAX_REPOS = 60;
const MAX_DEPTH = 4;

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

export async function getRepositories({ directory, extra }: RpcInput<typeof repositoriesRpc>) {
  const roots = new Map<string, string>();
  const warnings: string[] = [];
  const scannedRoots: string[] = [];
  let truncated = false;
  let usedFallback = false;
  const add = async (candidate: string, report: boolean) => {
    try {
      const root = await realpath(await repoRoot(candidate));
      const key = process.platform === "win32" ? root.toLowerCase() : root;
      if (!roots.has(key)) {
        if (roots.size >= MAX_REPOS) truncated = true;
        else roots.set(key, root);
      }
    } catch (error) {
      if (report) warnings.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const scanTree = async (root: string, maxDepth: number) => {
    scannedRoots.push(root);
    const queue = [{ directory: root, depth: 0 }];
    let visited = 0;
    while (queue.length && visited < MAX_DIRS && roots.size < MAX_REPOS) {
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
  // A project directory may hold only documents while sibling directories hold the repositories.
  if (roots.size === 0) {
    let parent = path.dirname(directory);
    for (let level = 0; level < 3; level++) {
      if (!parent || parent === path.parse(parent).root) break;
      await scanTree(parent, 1);
      if (roots.size > 0) { usedFallback = true; break; }
      parent = path.dirname(parent);
    }
  }
  for (const candidate of extra) {
    if (!path.isAbsolute(candidate)) warnings.push(`${candidate}: 请提供绝对路径`);
    else await add(candidate, true);
  }
  const repositories = await Promise.all([...roots.values()].map(summary));
  repositories.sort((a, b) => a.directory.localeCompare(b.directory));
  return { repositories, truncated, warnings: warnings.slice(0, 50), scannedRoots, usedFallback };
}
