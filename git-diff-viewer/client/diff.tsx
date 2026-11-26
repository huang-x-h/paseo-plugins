import { type PluginWorkspacePanelProps, useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { diffRpc } from "../shared/diff";
import { fileContentRpc } from "../shared/file";
import { branchesRpc } from "../shared/history";
import { matchingRemote } from "./branch-selection";
import { FileContentView } from "./file-view";
import { PatchView } from "./patch-view";

type Mode = "unstaged" | "branches";

export function DiffPanel({ theme, directory, upstream }: PluginWorkspacePanelProps & { directory: string; upstream: string }) {
  const rpc = useRpc(diffRpc);
  const getFileContent = useRpc(fileContentRpc);
  const getBranches = useRpc(branchesRpc);
  const [mode, setMode] = useState<Mode>("unstaged");
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"diff" | "content">("diff");
  const [localRef, setLocalRef] = useState("");
  const [remoteRef, setRemoteRef] = useState("");
  const [picker, setPicker] = useState<"local" | "remote" | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const branches = useQuery({ queryKey: ["git-branches", directory], queryFn: () => getBranches({ directory }), enabled: !!directory && mode === "branches" });
  const localBranches = branches.data?.branches.filter((item) => item.ref.startsWith("refs/heads/")) ?? [];
  const remoteBranches = branches.data?.branches.filter((item) => item.ref.startsWith("refs/remotes/")) ?? [];
  const local = localRef || localBranches.find((item) => item.name === branches.data?.current)?.ref || "";
  const remote = remoteRef || matchingRemote(local, remoteBranches, upstream, branches.data?.current ?? "");
  const ready = mode !== "branches" || (!!local && !!remote);
  const input = { directory, mode, localRef: local, remoteRef: remote };
  const list = useQuery({
    queryKey: ["git-diff-files", directory, mode, local, remote],
    queryFn: () => rpc({ ...input, file: null }),
    enabled: !!directory && ready,
  });
  const current = selected && list.data?.files.includes(selected) ? selected : null;
  const content = useQuery({
    queryKey: ["git-file-content", directory, mode, local, remote, current],
    queryFn: () => getFileContent({ directory, file: current!, source: mode === "unstaged" ? "worktree" : "commit", revision: mode === "unstaged" ? undefined : mode === "branches" ? local : "HEAD" }),
    enabled: !!directory && ready && !!current && view === "content",
  });
  const patch = useQuery({
    queryKey: ["git-diff-patch", directory, mode, local, remote, current],
    queryFn: () => rpc({ ...input, file: current }),
    enabled: !!directory && ready && !!current,
  });
  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted };
  const button = { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, backgroundColor: theme.colors.surface0 };
  const modes = ([["unstaged", "本地未提交"], ["branches", "分支比较"]] as const);
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
        <Pressable accessibilityRole="button" accessibilityLabel="刷新改动" onPress={() => { if (mode === "branches") void branches.refetch(); if (ready) void list.refetch(); if (current && ready) { void patch.refetch(); if (view === "content") void content.refetch(); } }} style={{ ...button, backgroundColor: theme.colors.surface1, borderWidth: 1, borderColor: theme.colors.border }}><Text style={text}>{list.isFetching || patch.isFetching ? "刷新中…" : "刷新"}</Text></Pressable>
      </View>
      {mode === "branches" && <View style={{ gap: 6 }}>
        <Text style={muted}>以源端和本地的共同祖先为基准，只显示本地分支的改动；不包含未提交改动，不自动 fetch。</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {([ ["local", local, localBranches, "本地"], ["remote", remote, remoteBranches, "源端"] ] as const).map(([kind, ref, options, label]) => <Pressable key={kind} accessibilityRole="button" accessibilityLabel={`选择${label}分支`} onPress={() => { setPicker(picker === kind ? null : kind); setBranchFilter(""); }} style={{ ...button, borderWidth: 1, borderColor: theme.colors.border }}><Text style={text}>{label}：{options.find((item) => item.ref === ref)?.name ?? "请选择"} ▾</Text></Pressable>)}
        </View>
        {picker && <View style={{ gap: 4 }}>
          <TextInput accessibilityLabel="搜索比较分支" value={branchFilter} onChangeText={setBranchFilter} placeholder="搜索分支" placeholderTextColor={theme.colors.foregroundMuted} style={{ ...text, borderWidth: 1, borderColor: theme.colors.border, padding: 6 }} />
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>{(picker === "local" ? localBranches : remoteBranches).filter((item) => item.name.toLowerCase().includes(branchFilter.toLowerCase())).map((item) => <Pressable key={item.ref} accessibilityRole="button" onPress={() => { if (picker === "local") { setLocalRef(item.ref); setRemoteRef(""); } else setRemoteRef(item.ref); setSelected(null); setPicker(null); }} style={{ padding: 6 }}><Text style={text}>{item.name}</Text></Pressable>)}</ScrollView>
        </View>}
        {!ready && <Text style={muted}>未找到唯一的同名源端分支，请手动选择；如没有源端分支，请先在仓库中执行 git fetch。</Text>}
        {branches.error && <Text style={text}>读取分支失败：{branches.error instanceof Error ? branches.error.message : String(branches.error)}</Text>}
      </View>}
      {mode === "unstaged" && <Text style={muted}>工作区相对 HEAD 的全部未提交改动，包含已暂存、未暂存和未跟踪文件。</Text>}
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
