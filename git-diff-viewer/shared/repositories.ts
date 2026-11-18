import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const repository = z.object({
  directory: z.string(), branch: z.string(), staged: z.number(), unstaged: z.number(), untracked: z.number(),
  conflicts: z.number(), ahead: z.number(), behind: z.number(), upstream: z.string(),
  lastCommit: z.string(), error: z.string(),
});
export const repositoriesRpc = defineRpc({
  name: "git.repositories",
  input: z.object({ directory: z.string().min(1), extra: z.array(z.string().min(1)).max(30) }),
  output: z.object({ repositories: z.array(repository), truncated: z.boolean(), warnings: z.array(z.string()) }),
});
