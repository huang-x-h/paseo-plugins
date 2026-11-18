import { type PluginWorkspacePanelProps, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { diffRpc } from "../shared/diff";
import { PatchView } from "./patch-view";

type Mode = "unstaged" | "upstream";

export function DiffPanel({ theme, layout, directory, upstream }: PluginWorkspacePanelProps & { directory: string; upstream: string }) {
  const rpc = useRpc(diffRpc);
  const [mode, setMode] = useState<Mode>("unstaged");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const input = { directory, mode };
  const list = useQuery({
    queryKey: ["git-diff-files", directory, mode],
    queryFn: () => rpc({ ...input, file: null }),
    enabled: !!directory,
  });
  const current = selected && list.data?.files.includes(selected) ? selected : null;
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
          <Pressable key={value} accessibilityRole="button" onPress={() => { setMode(value); setSelected(null); }} style={{ ...button, backgroundColor: mode === value ? theme.colors.accent : theme.colors.surface0 }}>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
        {files.map((file) => <View key={file} style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, overflow: "hidden" }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: current === file }} onPress={() => setSelected(current === file ? null : file)} style={{ padding: 10, backgroundColor: current === file ? theme.colors.surface2 : theme.colors.surface1 }}>
            <Text style={text}>{current === file ? "▾" : "▸"} {file}</Text>
          </Pressable>
          {current === file && <View style={{ height: layout.compact ? 300 : 420 }}><PatchView theme={theme} patch={patch.data?.patch || (patch.isFetching ? "正在读取 diff…" : "没有可显示的文本 diff。")} truncated={patch.data?.truncated} /></View>}
        </View>)}
        {list.data && list.data.files.length > 0 && files.length === 0 && <Text style={muted}>没有匹配的文件。</Text>}
      </ScrollView>
    </View>
  );
}
