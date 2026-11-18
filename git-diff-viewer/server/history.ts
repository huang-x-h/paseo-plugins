import type { RpcInput } from "@getpaseo/plugin";
import { branchesRpc, commitRpc, historyRpc } from "../shared/history";
import { git } from "./diff";

export async function getBranches({ directory }: RpcInput<typeof branchesRpc>) {
  const [raw, current] = await Promise.all([
    git(directory, ["for-each-ref", "--format=%(refname)%00%(refname:short)", "refs/heads", "refs/remotes"]),
    git(directory, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "HEAD"),
  ]);
  const branches = raw.split("\n").filter(Boolean).map((line) => {
    const [ref, name] = line.split("\0");
    return { ref, name };
  }).filter(({ ref }) => !ref.endsWith("/HEAD"));
  return { current: current.trim(), branches };
}

export async function getHistory({ directory, ref, skip }: RpcInput<typeof historyRpc>) {
  // Only accept actual branch refs (or HEAD); never allow user input to become an option.
  if (ref !== "HEAD") {
    const { branches } = await getBranches({ directory });
    if (!branches.some((branch) => branch.ref === ref)) throw new Error("分支不存在或已被删除，请刷新分支列表。");
  }
  const raw = await git(directory, ["log", "-z", "-101", `--skip=${skip}`, "--format=%H%x00%h%x00%an%x00%aI%x00%s", ref, "--"]);
  const fields = raw.split("\0");
  const commits = [];
  for (let i = 0; i + 4 < fields.length; i += 5) {
    commits.push({ hash: fields[i], shortHash: fields[i + 1], author: fields[i + 2], date: fields[i + 3], subject: fields[i + 4] });
  }
  return { commits: commits.slice(0, 100), hasMore: commits.length > 100 };
}

export async function getCommit({ directory, hash, file }: RpcInput<typeof commitRpc>) {
  const [rawFiles, message] = await Promise.all([
    git(directory, ["diff-tree", "--root", "--first-parent", "--no-commit-id", "--no-renames", "--name-only", "-r", "-z", hash, "--"]),
    git(directory, ["show", "-s", "--format=%B", hash, "--"]),
  ]);
  const files = rawFiles.split("\0").filter(Boolean);
  if (file === null || !files.includes(file)) return { files, message: message.trimEnd(), patch: "", truncated: false };
  const patch = await git(directory, ["show", "--first-parent", "--format=", "--no-ext-diff", "--no-textconv", "--no-renames", "--no-color", hash, "--", file]);
  const limit = 200_000;
  return { files, message: message.trimEnd(), patch: patch.slice(0, limit), truncated: patch.length > limit };
}
