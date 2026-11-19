import { type PluginClientContext, type PluginWorkspacePanelProps, useRpc, useWorkspace } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { DiffPanel } from "./client/diff";
import { HistoryPanel } from "./client/history";
import { repositoriesRpc } from "./shared/repositories";

type Tab = "changes" | "history";

function GitPanel(props: PluginWorkspacePanelProps) {
  const { theme, layout, workspaceId } = props;
  const directory = useWorkspace(workspaceId, (workspace) => workspace.directory) ?? "";
  const getRepositories = useRpc(repositoriesRpc);
  const [tab, setTab] = useState<Tab>("changes");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("");
  const [repoPicker, setRepoPicker] = useState(false);
  const [extraRoots, setExtraRoots] = useState<string[]>([]);
  const result = useQuery({
    queryKey: ["git-repositories", directory, extraRoots],
    queryFn: () => getRepositories({ directory, roots: extraRoots }),
    enabled: !!directory,
    staleTime: Infinity,
  });
  const repositories = result.data?.repositories ?? [];
  const currentRepo = repositories.find((repo) => repo.directory === selected) ?? repositories[0];
  const current = currentRepo?.directory ?? "";
  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted };
  const button = { padding: 8, borderWidth: 1, borderColor: theme.colors.foregroundMuted, borderRadius: 5 };
  const active = { backgroundColor: theme.colors.accent };
  const activeText = { color: theme.colors.accentForeground };
  const changed = currentRepo ? currentRepo.staged + currentRepo.unstaged + currentRepo.untracked + currentRepo.conflicts : 0;
  const matched = repositories.filter((repo) => repo.directory.toLowerCase().includes(filter.trim().toLowerCase()));
  return <View style={{ flex: 1, backgroundColor: theme.colors.surface0 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: layout.compact ? 10 : 16, paddingTop: 10, gap: 8 }}>
      {([ ["changes", "工作区改动"], ["history", "分支与历史"] ] as const).map(([id, title]) => <Pressable key={id} accessibilityRole="button" onPress={() => setTab(id)} style={{ padding: 8, borderRadius: 5, ...(tab === id ? active : {}) }}><Text style={tab === id ? activeText : text}>{title}</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="刷新仓库列表" onPress={() => void result.refetch()} style={{ padding: 8, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.border }}><Text style={text}>{result.isFetching ? "刷新中…" : "刷新"}</Text></Pressable>
    </View>
    <View style={{ flex: 1, gap: 10, padding: layout.compact ? 10 : 16 }}>
      <View style={{ gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="选择仓库" accessibilityState={{ expanded: repoPicker }} onPress={() => setRepoPicker(!repoPicker)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface1 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={text} selectable>{currentRepo ? currentRepo.directory : result.isFetching ? "正在扫描仓库…" : "未找到 Git 仓库"}</Text>
            {currentRepo && <Text numberOfLines={1} style={muted}>
              {currentRepo.branch || "未知分支"}{currentRepo.upstream ? ` → ${currentRepo.upstream}` : ""}{currentRepo.upstream ? ` ↑${currentRepo.ahead} ↓${currentRepo.behind}` : ""}
              {changed > 0 ? ` · ${changed} 处改动` : " · 工作区干净"}
            </Text>}
            {currentRepo?.lastCommit && <Text numberOfLines={1} style={muted}>最近提交：{currentRepo.lastCommit}</Text>}
          </View>
          <Text style={muted}>{repoPicker ? "▴" : "▾"}</Text>
        </Pressable>
        {repoPicker && <View style={{ gap: 6 }}>
          <TextInput accessibilityLabel="检索仓库" value={filter} onChangeText={setFilter} placeholder="按仓库路径检索" placeholderTextColor={theme.colors.foregroundMuted} style={{ ...button, ...text }} />
          <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 4 }}>
            {matched.map((repo) => <Pressable accessibilityRole="button" key={repo.directory} onPress={() => { setSelected(repo.directory); setRepoPicker(false); }} style={{ padding: 8, borderRadius: 5, backgroundColor: current === repo.directory ? theme.colors.accent : theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }}>
              <Text numberOfLines={1} style={{ ...(current === repo.directory ? activeText : text), fontSize: 12 }} selectable>{repo.directory}</Text>
              <Text numberOfLines={1} style={{ ...(current === repo.directory ? activeText : muted), fontSize: 11 }}>{repo.branch || "未知分支"}{repo.staged + repo.unstaged + repo.untracked > 0 ? ` · ${repo.staged + repo.unstaged + repo.untracked} 处改动` : ""}</Text>
            </Pressable>)}
            {repositories.length === 0 && <Text style={muted}>{result.isFetching ? "正在扫描…" : "没有可切换的仓库。"}</Text>}
            {repositories.length > 0 && matched.length === 0 && <Text style={muted}>没有匹配的仓库。</Text>}
          </ScrollView>
        </View>}
      </View>
      {result.error && <Text selectable style={text}>扫描失败：{result.error instanceof Error ? result.error.message : String(result.error)}</Text>}
      {result.data?.suggestions.map((suggestion) => <View key={suggestion.directory} style={{ gap: 6 }}>
        <Text style={muted}>工作区内没有仓库。上级目录 {suggestion.directory} 下有 {suggestion.repositoryCount} 个仓库。</Text>
        <Pressable accessibilityRole="button" onPress={() => setExtraRoots([...extraRoots, suggestion.directory])} style={button}><Text style={text}>扫描该目录</Text></Pressable>
      </View>)}
      {extraRoots.map((root) => <View key={root} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ ...muted, flex: 1 }} numberOfLines={1} selectable>附加目录：{root}</Text>
        <Pressable accessibilityRole="button" onPress={() => setExtraRoots(extraRoots.filter((item) => item !== root))} style={button}><Text style={text}>移除</Text></Pressable>
      </View>)}
      {!current ? <Text style={muted}>{result.isFetching ? "正在扫描工作区中的 Git 仓库…" : "工作区中没有找到 Git 仓库。"}</Text> : tab === "changes" ? <DiffPanel key={current} {...props} directory={current} upstream={currentRepo?.upstream ?? ""} /> : <HistoryPanel key={current} {...props} directory={current} />}
    </View>
  </View>;
}

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({ id: "git-diff", title: "Git 仓库", icon: "GitCompare", context: "workspace", locations: ["workspace", "explorer"], Component: GitPanel });
  client.addCommandCenterItem({ id: "open-git-diff", title: "打开 Git 仓库面板", icon: "GitCompare", context: "workspace", onSelect({ openPanel }) { openPanel("git-diff"); } });
  return () => {};
}
