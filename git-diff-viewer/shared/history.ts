import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const commit = z.object({ hash: z.string(), shortHash: z.string(), author: z.string(), date: z.string(), subject: z.string() });
export const branchesRpc = defineRpc({
  name: "git.branches",
  input: z.object({ directory: z.string().min(1) }),
  output: z.object({ current: z.string(), branches: z.array(z.object({ ref: z.string(), name: z.string() })) }),
});
export const historyRpc = defineRpc({
  name: "git.history",
  input: z.object({ directory: z.string().min(1), ref: z.string(), skip: z.number().int().min(0).max(100000) }),
  output: z.object({ commits: z.array(commit), hasMore: z.boolean() }),
});
export const commitRpc = defineRpc({
  name: "git.commit",
  input: z.object({ directory: z.string().min(1), hash: z.string().regex(/^[a-f0-9]{40,64}$/), file: z.string().nullable() }),
  output: z.object({ files: z.array(z.string()), message: z.string(), patch: z.string(), truncated: z.boolean() }),
});
