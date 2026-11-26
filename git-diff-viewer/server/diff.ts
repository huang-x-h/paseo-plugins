import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import { diffRpc } from "../shared/diff";

const exec = promisify(execFile);
const MAX_OUTPUT = 4 * 1024 * 1024;

export async function git(directory: string, args: string[]) {
  const { stdout } = await exec("git", ["--no-pager", "--literal-pathspecs", ...args], {
    cwd: directory,
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT,
    timeout: 15000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout;
}

export async function gitBuffer(directory: string, args: string[]) {
  const { stdout } = await exec("git", ["--no-pager", "--literal-pathspecs", ...args], {
    cwd: directory,
    encoding: "buffer",
    maxBuffer: MAX_OUTPUT,
    timeout: 15000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout as Buffer;
}

export async function getDiff(input: RpcInput<typeof diffRpc>) {
  const { directory, mode, file } = input;
  const options = ["-c", "core.quotepath=false", "diff", "--no-ext-diff", "--no-textconv", "--no-color", "--no-renames"];
  if (mode === "upstream") {
    let upstream: string;
    try {
      upstream = (await git(directory, ["rev-parse", "--verify", "--end-of-options", "@{upstream}^{commit}"])).trim();
    } catch {
      throw new Error("当前分支没有可用的上游跟踪分支。请先配置上游，必要时执行 git fetch。");
    }
    options.push(upstream, "HEAD");
  }
  if (mode === "branches") {
    const { localRef, remoteRef } = input;
    if (!localRef?.startsWith("refs/heads/") || !remoteRef?.startsWith("refs/remotes/") || remoteRef.endsWith("/HEAD")) {
      throw new Error("请选择有效的本地分支和源端分支。");
    }
    try {
      const [local, remote] = await Promise.all([localRef, remoteRef].map((ref) => git(directory, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`])));
      const base = (await git(directory, ["merge-base", remote.trim(), local.trim()])).trim();
      if (!base) throw new Error("no merge base");
      options.push(base, local.trim());
    } catch {
      throw new Error("无法比较分支：分支不存在、已被删除或没有共同祖先。请检查并刷新分支列表。");
    }
  }
  if (mode === "unstaged") {
    // Uncommitted content: staged plus unstaged changes against HEAD.
    options.push("HEAD");
  }
  const files = (await git(directory, [...options, "--name-only", "-z", "--"]))
    .split("\0").filter(Boolean);
  const untracked = mode === "unstaged" ? (await git(directory, ["ls-files", "--others", "--exclude-standard", "-z", "--"])).split("\0").filter(Boolean) : [];
  for (const name of untracked) if (!files.includes(name)) files.push(name);
  const emptyStats = { additions: 0, deletions: 0, statsIncomplete: false };
  if (file !== null && !files.includes(file)) return { files, patch: "", truncated: false, ...emptyStats };
  if (file === null) {
    const numstat = await git(directory, [...options, "--numstat", "-z", "--"]);
    const stats = { ...emptyStats };
    for (const record of numstat.split("\0").filter(Boolean)) {
      const first = record.indexOf("\t");
      const second = record.indexOf("\t", first + 1);
      const added = record.slice(0, first), removed = record.slice(first + 1, second);
      if (first < 0 || second < 0 || added === "-" || removed === "-") { stats.statsIncomplete = true; continue; }
      stats.additions += Number(added); stats.deletions += Number(removed);
    }
    let bytesRead = 0;
    for (const [index, name] of untracked.entries()) {
      if (index >= 500 || bytesRead >= 8_000_000) { stats.statsIncomplete = true; break; }
      try {
        const root = path.resolve(directory), target = path.resolve(root, name);
        if (!target.startsWith(root + path.sep)) { stats.statsIncomplete = true; continue; }
        const info = await lstat(target);
        if (!info.isFile() || info.size > 200_000 || bytesRead + info.size > 8_000_000) { stats.statsIncomplete = true; continue; }
        const data = await readFile(target); bytesRead += data.length;
        if (data.includes(0)) { stats.statsIncomplete = true; continue; }
        if (data.length) stats.additions += data.toString("utf8").split("\n").length - (data[data.length - 1] === 10 ? 1 : 0);
      } catch { stats.statsIncomplete = true; }
    }
    return { files, patch: "", truncated: false, ...stats };
  }
  if (untracked.includes(file)) {
    const root = path.resolve(directory);
    const target = path.resolve(root, file);
    if (!target.startsWith(root + path.sep)) throw new Error("无效的仓库文件路径");
    const info = await lstat(target);
    if (info.isSymbolicLink()) return { files, patch: `未跟踪的符号链接：${file}（不读取目标）`, truncated: false, ...emptyStats };
    if (!info.isFile()) return { files, patch: `无法预览非普通文件：${file}`, truncated: false, ...emptyStats };
    if (info.size > 200_000) return { files, patch: `未跟踪文件过大（${info.size} 字节），不预览。`, truncated: true, ...emptyStats };
    const data = await readFile(target);
    if (data.includes(0)) return { files, patch: `未跟踪的二进制文件：${file}`, truncated: false, ...emptyStats };
    const lines = data.toString("utf8").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return { files, patch: `未跟踪文件：${file}\n${lines.map((line) => `+${line}`).join("\n")}`, truncated: false, ...emptyStats };
  }
  const patch = await git(directory, [...options, "--", file]);
  const limit = 200_000;
  return { files, patch: patch.slice(0, limit), truncated: patch.length > limit, ...emptyStats };
}
