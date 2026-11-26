import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const diffRpc = defineRpc({
  name: "git.diff",
  input: z.object({
    directory: z.string().min(1),
    mode: z.enum(["unstaged", "upstream", "branches"]),
    file: z.string().nullable(),
    localRef: z.string().optional(),
    remoteRef: z.string().optional(),
  }),
  output: z.object({ files: z.array(z.string()), patch: z.string(), truncated: z.boolean(), additions: z.number(), deletions: z.number(), statsIncomplete: z.boolean() }),
});
