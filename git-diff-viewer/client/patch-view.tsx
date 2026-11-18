import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

type Line = { text: string; kind: "add" | "delete" | "hunk" | "header" | "context"; oldLine: number | null; newLine: number | null };

const FILE_HEADER = /^(diff --git |index |--- |\+\+\+ |old mode |new mode |similarity index |dissimilarity index |rename from |rename to )/;

function tint(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const number = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(number)) return hex;
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function parsePatch(patch: string): Line[] {
  let oldLine: number | null = null;
  let newLine: number | null = null;
  let inHunk = false;
  const lines: Line[] = [];
  for (const text of patch.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]); newLine = Number(hunk[2]); inHunk = true;
      lines.push({ text, kind: "hunk", oldLine: null, newLine: null });
      continue;
    }
    if (!inHunk) {
      if (FILE_HEADER.test(text)) continue;
      if (text.startsWith("未跟踪文件：")) { inHunk = true; newLine = 1; lines.push({ text, kind: "header", oldLine: null, newLine: null }); continue; }
      if (/^(new file mode |deleted file mode |Binary files |unmerged |changed in )/.test(text)) { lines.push({ text, kind: "header", oldLine: null, newLine: null }); continue; }
      continue;
    }
    if (text.startsWith("+")) { lines.push({ text, kind: "add", oldLine: null, newLine: newLine === null ? null : newLine++ }); continue; }
    if (text.startsWith("-")) { lines.push({ text, kind: "delete", oldLine: oldLine === null ? null : oldLine++, newLine: null }); continue; }
    if (text.startsWith(" ")) { lines.push({ text, kind: "context", oldLine: oldLine === null ? null : oldLine++, newLine: newLine === null ? null : newLine++ }); continue; }
    if (text.startsWith("\\")) { lines.push({ text, kind: "header", oldLine: null, newLine: null }); continue; }
  }
  return lines;
}

export function PatchView({ patch, truncated, theme }: { patch: string; truncated?: boolean; theme: PluginTheme }) {
  const lines = useMemo(() => parsePatch(patch), [patch]);
  const colors = theme.colors;
  const gutter = (line: Line) => `${line.oldLine === null ? "" : line.oldLine}`.padStart(5) + " " + `${line.newLine === null ? "" : line.newLine}`.padStart(5) + "  ";
  return <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface1, overflow: "hidden" }}>
    <ScrollView style={{ flex: 1 }}><ScrollView horizontal>
      <Text selectable style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 20, color: colors.foreground }}>
        {lines.map((line, index) => {
          const color = line.kind === "add" ? colors.statusSuccess : line.kind === "delete" ? colors.statusDanger : line.kind === "hunk" ? colors.accent : line.kind === "header" ? colors.foregroundMuted : colors.foreground;
          const backgroundColor = line.kind === "add" ? tint(colors.statusSuccess, 0.14) : line.kind === "delete" ? tint(colors.statusDanger, 0.14) : line.kind === "hunk" || line.kind === "header" ? colors.surface2 : colors.surface1;
          const text = line.kind === "hunk" || line.kind === "header" ? line.text : `${gutter(line)}${line.text}`;
          return <Text key={index} style={{ color, backgroundColor }}>{text}{index < lines.length - 1 ? "\n" : ""}</Text>;
        })}
        {truncated && <Text style={{ color: colors.statusWarning }}>{"\n\n[内容过长，已截断]"}</Text>}
      </Text>
    </ScrollView></ScrollView>
  </View>;
}
