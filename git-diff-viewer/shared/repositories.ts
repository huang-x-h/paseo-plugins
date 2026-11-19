import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const repository = z.object({
  directory: z.string(), branch: z.string(), staged: z.number(), unstaged: z.number(), untracked: z.number(),
  conflicts: z.number(), ahead: z.number(), behind: z.number(), upstream: z.string(),
  lastCommit: z.string(), error: z.string(),
});
export const repositoriesRpc = defineRpc({
  name: "git.repositories",
  input: z.object({
    directory: z.string().min(1),
    // Directories the user explicitly chose to scan in addition to the workspace.
    roots: z.array(z.string().min(1)).max(20),
  }),
  output: z.object({
    repositories: z.array(repository),
    truncated: z.boolean(),
    warnings: z.array(z.string()),
    scannedRoots: z.array(z.string()),
    // Parent directories that contain repositories, offered for the user to confirm.
    suggestions: z.array(z.object({ directory: z.string(), repositoryCount: z.number() })),
  }),
});
