import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const fileContentRpc = defineRpc({
  name: "git.file-content",
  input: z.object({
    directory: z.string().min(1),
    file: z.string().min(1),
    // worktree reads the file from disk; commit reads it from a revision.
    source: z.enum(["worktree", "commit"]),
    revision: z.string().max(1024).optional(),
  }),
  output: z.object({
    content: z.string(),
    truncated: z.boolean(),
    binary: z.boolean(),
    totalLines: z.number(),
  }),
});
