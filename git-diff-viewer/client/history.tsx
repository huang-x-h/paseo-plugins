import { type PluginWorkspacePanelProps, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { branchesRpc, commitRpc, historyRpc } from "../shared/history";
import { PatchView } from "./patch-view";

export function HistoryPanel({ directory, theme, layout }: PluginWorkspacePanelProps & { directory: string }) {
  const getBranches = useRpc(branchesRpc);
  const getHistory = useRpc(historyRpc);
  const getCommit = useRpc(commitRpc);
  const [ref, setRef] = useState("HEAD");
  const [branchPicker, setBranchPicker] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const branches = useQuery({ queryKey: ["git-branches", directory], queryFn: () => getBranches({ directory }), enabled: !!directory });
  const history = useQuery({ queryKey: ["git-history", directory, ref, page], queryFn: () => getHistory({ directory, ref, skip: page * 100 }), enabled: !!directory });
  const commit = history.data?.commits.find((item) => item.hash === selectedHash) ?? history.data?.commits[0];
  const files = useQuery({ queryKey: ["git-commit-files", directory, commit?.hash], queryFn: () => getCommit({ directory, hash: commit!.hash, file: null }), enabled: !!directory && !!commit });
  const file = selectedFile && files.data?.files.includes(selectedFile) ? selectedFile : files.data?.files[0] ?? null;
  const patch = useQuery({ queryKey: ["git-commit-patch", directory, commit?.hash, file], queryFn: () => getCommit({ directory, hash: commit!.hash, file }), enabled: !!directory && !!commit && !!file });
  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted };
  const button = { padding: 8, borderWidth: 1, borderColor: theme.colors.foregroundMuted, borderRadius: 5 };
  const selectedStyle = { backgroundColor: theme.colors.accent };
  const selectedText = { color: theme.colors.accentForeground };
  const branchName = ref === "HEAD" ? `当前 HEAD (${branches.data?.current ?? "…"})` : branches.data?.branches.find((item) => item.ref === ref)?.name ?? ref;
  const body = (files.data?.message ?? "").split("\n").slice(1).join("\n").trim();
  const error = branches.error ?? history.error ?? files.error ?? patch.error;
  const changeRef = (value: string) => { setRef(value); setPage(0); setSelectedHash(null); setSelectedFile(null); setBranchPicker(false); };
  return <View style={{ flex: 1, gap: 8, backgroundColor: theme.colors.surface0 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="选择分支" onPress={() => setBranchPicker(!branchPicker)} style={button}><Text style={text}>分支：{branchName} ▾</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void branches.refetch(); void history.refetch(); if (commit) void files.refetch(); if (file) void patch.refetch(); }} style={button}><Text style={text}>刷新</Text></Pressable>
    </View>
    {branchPicker && <View style={{ maxHeight: 240, gap: 5 }}>
      <TextInput accessibilityLabel="搜索分支" value={branchFilter} onChangeText={setBranchFilter} placeholder="搜索本地或远程分支" placeholderTextColor={theme.colors.foregroundMuted} style={{ ...text, ...button }} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => changeRef("HEAD")} style={{ padding: 8 }}><Text style={text}>当前 HEAD ({branches.data?.current ?? "…"})</Text></Pressable>
        {branches.data?.branches.filter((item) => item.name.toLowerCase().includes(branchFilter.toLowerCase())).map((item) => <Pressable accessibilityRole="button" key={item.ref} onPress={() => changeRef(item.ref)} style={{ padding: 8 }}><Text style={text}>{item.name}{item.name === branches.data?.current && item.ref.startsWith("refs/heads/") ? " （当前）" : ""}</Text></Pressable>)}
      </ScrollView>
    </View>}
    {error && <Text selectable style={text}>读取失败：{error instanceof Error ? error.message : String(error)}</Text>}
    {!directory && <Text style={muted}>工作区目录不可用。</Text>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Text style={muted}>{history.isFetching ? "正在读取提交…" : `提交历史 · 第 ${page + 1} 页（每页 100 条）`}</Text>
      <Pressable accessibilityRole="button" disabled={page === 0} onPress={() => { setPage(page - 1); setSelectedHash(null); setSelectedFile(null); }} style={button}><Text style={page === 0 ? muted : text}>上一页</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!history.data?.hasMore || page >= 1000} onPress={() => { setPage(page + 1); setSelectedHash(null); setSelectedFile(null); }} style={button}><Text style={history.data?.hasMore ? text : muted}>下一页</Text></Pressable>
    </View>
    <View style={{ flex: 1, gap: 10 }}>
      <ScrollView style={{ flexGrow: 0, maxHeight: layout.compact ? 180 : 260 }} contentContainerStyle={{ gap: 4 }}>
        {history.data?.commits.map((item) => <Pressable key={item.hash} accessibilityRole="button" onPress={() => { setSelectedHash(item.hash); setSelectedFile(null); }} style={{ padding: 8, gap: 2, ...(commit?.hash === item.hash ? selectedStyle : {}) }}>
          <Text numberOfLines={2} style={commit?.hash === item.hash ? selectedText : text}>{item.subject}</Text>
          <Text numberOfLines={1} style={commit?.hash === item.hash ? selectedText : muted}>{item.shortHash} · {item.author} · {item.date.slice(0, 10)}</Text>
        </Pressable>)}
        {!history.isFetching && history.data?.commits.length === 0 && <Text style={muted}>没有提交记录。</Text>}
      </ScrollView>
      <View style={{ flex: 1, gap: 6, minHeight: 0 }}>
        {commit && <View style={{ gap: 2 }}>
          <Text numberOfLines={1} style={{ ...muted, fontFamily: "monospace", fontSize: 11 }} selectable>{commit.hash}</Text>
          {body && <Text selectable style={text}>{body}</Text>}
        </View>}
        <ScrollView style={{ flexGrow: 0, maxHeight: 140 }} contentContainerStyle={{ gap: 4 }}>
          {files.data?.files.map((name) => <Pressable accessibilityRole="button" key={name} onPress={() => setSelectedFile(name)} style={{ padding: 6, borderRadius: 4, backgroundColor: file === name ? theme.colors.accent : theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }}><Text numberOfLines={2} style={{ ...(file === name ? selectedText : text), fontSize: 12 }}>{name}</Text></Pressable>)}
        </ScrollView>
        {files.isFetching && <Text style={muted}>正在读取文件…</Text>}
        {files.data && files.data.files.length === 0 && <Text style={muted}>此提交没有文件改动。</Text>}
        <PatchView theme={theme} patch={patch.data?.patch || (patch.isFetching ? "正在读取 diff…" : file ? "没有可显示的文本 diff。" : "选择提交和文件查看 diff。")} truncated={patch.data?.truncated} />
      </View>
    </View>
  </View>;
}
