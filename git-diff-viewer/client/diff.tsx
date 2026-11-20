import { type PluginWorkspacePanelProps, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { diffRpc } from "../shared/diff";
import { fileContentRpc } from "../shared/file";
import { FileContentView } from "./file-view";
import { PatchView } from "./patch-view";

type Mode = "unstaged" | "upstream";

export function DiffPanel({ theme, directory, upstream }: PluginWorkspacePanelProps & { directory: string; upstream: string }) {
  const rpc = useRpc(diffRpc);
  const getFileContent = useRpc(fileContentRpc);
  const [mode, setMode] = useState<Mode>("unstaged");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"diff" | "content">("diff");
  const input = { directory, mode };
  const list = useQuery({
    queryKey: ["git-diff-files", directory, mode],
    queryFn: () => rpc({ ...input, file: null }),
    enabled: !!directory,
  });
  const current = selected && list.data?.files.includes(selected) ? selected : null;
  const content = useQuery({
    queryKey: ["git-file-content", directory, mode, current],
    queryFn: () => getFileContent({ directory, file: current!, source: mode === "unstaged" ? "worktree" : "commit", revision: mode === "unstaged" ? undefined : "HEAD" }),
    enabled: !!directory && !!current && view === "content",
  });
  const patch = useQuery({
    queryKey: ["git-diff-patch", directory, mode, current],
    queryFn: () => rpc({ ...input, file: current }),
    enabled: !!directory && !!current,
  });
  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted };
  const button = { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, backgroundColor: theme.colors.surface0 };
  const hasUpstream = !!upstream;
  useEffect(() => { if (!hasUpstream && mode === "upstream") setMode("unstaged"); }, [hasUpstream, mode]);
  const modes = ([["unstaged", "本地未提交"], ...(hasUpstream ? [["upstream", "本地与源端"] as const] : [])] as const);
  const files = list.data?.files.filter((file) => file.toLowerCase().includes(filter.toLowerCase())) ?? [];
  const error = list.error ?? patch.error;
  return (
    <View style={{ flex: 1, gap: 10, backgroundColor: theme.colors.surface0 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {modes.map(([value, label]) => (
          <Pressable key={value} accessibilityRole="button" onPress={() => { setMode(value); setSelected(null); setView("diff"); }} style={{ ...button, backgroundColor: mode === value ? theme.colors.accent : theme.colors.surface0 }}>
            <Text style={{ color: mode === value ? theme.colors.accentForeground : theme.colors.foreground }}>{label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="刷新改动" onPress={() => { void list.refetch(); if (current) void patch.refetch(); }} style={{ ...button, backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }}><Text style={text}>{list.isFetching || patch.isFetching ? "刷新中…" : "刷新"}</Text></Pressable>
      </View>
      {mode === "unstaged" && <Text style={muted}>工作区相对 HEAD 的全部未提交改动，包含已暂存、未暂存和未跟踪文件。</Text>}
      {mode === "upstream" && hasUpstream && <Text style={muted}>比较 {upstream} → 本地 HEAD 的提交快照，不包含未提交改动。使用本地远端跟踪引用，不自动 fetch。</Text>}
      {list.data && <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Text style={muted}>当前范围 · {list.data.files.length} 个文件</Text>
        <Text style={{ color: theme.colors.statusSuccess, fontWeight: "600" }}>+{list.data.additions}</Text>
        <Text style={{ color: theme.colors.statusDanger, fontWeight: "600" }}>−{list.data.deletions}</Text>
        {list.data.statsIncomplete && <Text style={muted}>部分文件无法统计（如二进制或大文件）</Text>}
      </View>}
      <TextInput accessibilityLabel="筛选文件" value={filter} onChangeText={setFilter} placeholder="筛选文件路径" placeholderTextColor={theme.colors.foregroundMuted} style={{ ...text, borderWidth: 1, borderColor: theme.colors.foregroundMuted, padding: 8 }} />
      {error && <Text style={text} selectable>读取失败：{error instanceof Error ? error.message : String(error)}</Text>}
      {list.isFetching && !list.data && <Text style={muted}>正在读取改动…</Text>}
      {list.data && list.data.files.length === 0 && <Text style={muted}>没有该范围内的文件改动。</Text>}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
        {files.map((file) => <View key={file} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, overflow: "hidden" }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: current === file }} onPress={() => setSelected(current === file ? null : file)} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: current === file ? theme.colors.surface2 : theme.colors.surface1 }}>
            <Text style={text} numberOfLines={2}>{current === file ? "▾" : "▸"} {file}</Text>
          </Pressable>
          {current === file && <View style={{ gap: 6, padding: 8 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {([["diff", "差异"], ["content", "全文"]] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="button" onPress={() => setView(value)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: view === value ? theme.colors.accent : theme.colors.surface1 }}><Text style={{ color: view === value ? theme.colors.accentForeground : theme.colors.foreground, fontSize: 12 }}>{label}</Text></Pressable>)}
            </View>
            {view === "diff" ? <PatchView theme={theme} patch={patch.data?.patch || (patch.isFetching ? "正在读取 diff…" : "没有可显示的文本 diff。")} truncated={patch.data?.truncated} /> : content.isFetching ? <Text style={muted}>正在读取文件内容…</Text> : content.error ? <Text selectable style={text}>读取失败：{content.error instanceof Error ? content.error.message : String(content.error)}</Text> : content.data?.binary ? <Text style={muted}>二进制文件，不显示内容。</Text> : <FileContentView content={content.data?.content ?? ""} truncated={content.data?.truncated ?? false} totalLines={content.data?.totalLines ?? 0} theme={theme} />}
          </View>}
        </View>)}
        {list.data && list.data.files.length > 0 && files.length === 0 && <Text style={muted}>没有匹配的文件。</Text>}
      </ScrollView>
    </View>
  );
}
