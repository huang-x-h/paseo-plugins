import type { PluginServerContext } from "@getpaseo/plugin/server";
import { getDiff } from "./server/diff";
import { diffRpc } from "./shared/diff";
import { branchesRpc, historyRpc, commitRpc } from "./shared/history";
import { getBranches, getHistory, getCommit } from "./server/history";
import { repositoriesRpc } from "./shared/repositories";
import { getRepositories } from "./server/repositories";

export default function contribute(server: PluginServerContext) {
  server.handle(diffRpc, getDiff);
  server.handle(branchesRpc, getBranches);
  server.handle(historyRpc, getHistory);
  server.handle(commitRpc, getCommit);
  server.handle(repositoriesRpc, getRepositories);
  return () => {};
}
