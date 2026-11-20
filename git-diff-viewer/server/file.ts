import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { RpcInput } from "@getpaseo/plugin";
import { fileContentRpc } from "../shared/file";
import { gitBuffer } from "./diff";

const MAX_BYTES = 200_000;
const MAX_LINES = 5000;
const NUL = 0;

function finish(text: string, binary: boolean, truncated: boolean) {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const totalLines = lines.length;
  const limited = lines.slice(0, MAX_LINES).join("\n");
  return { content: limited, truncated: truncated || totalLines > MAX_LINES, binary, totalLines };
}

export async function getFileContent(input: RpcInput<typeof fileContentRpc>) {
  const { directory, file, source } = input;
  if (source === "commit") {
    const revision = input.revision ?? "HEAD";
    if (!/^(HEAD|[0-9a-f]{4,64})$/.test(revision)) throw new Error("无效的修订号。");
    // The path follows the colon, so reject anything that could change the meaning.
    if (file.startsWith("-") || file.includes("..") || file.includes(":")) throw new Error("无效的文件路径。");
    let raw: Buffer;
    try {
      raw = await gitBuffer(directory, ["show", `${revision}:${file}`]);
    } catch (error) {
      throw new Error(`无法读取 ${revision} 中的 ${file}：${error instanceof Error ? error.message : String(error)}`);
    }
    if (raw.includes(NUL)) return finish("", true, false);
    return finish(raw.toString("utf8").slice(0, MAX_BYTES), false, raw.length > MAX_BYTES);
  }
  const root = path.resolve(directory);
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep)) throw new Error("无效的仓库文件路径。");
  let data: Buffer;
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw new Error("暂不支持符号链接。");
    if (!info.isFile()) throw new Error("无法预览非普通文件。");
    data = await readFile(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    // The file was deleted in the working tree; show its last committed version.
    return getFileContent({ ...input, source: "commit", revision: "HEAD" });
  }
  if (data.includes(NUL)) return finish("", true, false);
  return finish(data.toString("utf8").slice(0, MAX_BYTES), false, data.length > MAX_BYTES);
}
