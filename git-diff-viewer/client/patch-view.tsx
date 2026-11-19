import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

type Line = { text: string; kind: "add" | "delete" | "hunk" | "header" | "context"; oldLine: number | null; newLine: number | null };

const FILE_HEADER = /^(diff --git |index |--- |\+\+\+ |old mode |new mode |similarity index |dissimilarity index |rename from |rename to )/;
const FONT_SIZE = 12;
const GUTTER_WIDTH = 4 * 2 + 3;

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

export function PatchView({ patch, truncated, theme, maxHeight }: { patch: string; truncated?: boolean; theme: PluginTheme; maxHeight?: number }) {
  const lines = useMemo(() => parsePatch(patch), [patch]);
  const colors = theme.colors;
  const bodyWidth = useMemo(() => {
    let longest = 0;
    for (const line of lines) longest = Math.max(longest, line.text.length);
    return Math.round(longest * FONT_SIZE * 0.6) + GUTTER_WIDTH;
  }, [lines]);
  const gutter = (line: Line) => `${line.oldLine ?? ""}`.padStart(4) + " " + `${line.newLine ?? ""}`.padStart(4) + " ";
  const colorFor = (kind: Line["kind"]) => kind === "add" ? colors.statusSuccess : kind === "delete" ? colors.statusDanger : kind === "hunk" ? colors.accent : kind === "header" ? colors.foregroundMuted : colors.foreground;
  const backgroundFor = (kind: Line["kind"]) => kind === "add" ? tint(colors.statusSuccess, 0.16) : kind === "delete" ? tint(colors.statusDanger, 0.16) : kind === "hunk" ? colors.surface2 : kind === "header" ? colors.surface2 : "transparent";
  const body = <View style={{ minWidth: bodyWidth }}>
        {lines.map((line, index) => {
          const isMeta = line.kind === "hunk" || line.kind === "header";
          return <View key={index} style={{ flexDirection: "row", backgroundColor: backgroundFor(line.kind) }}>
            <Text style={{ width: GUTTER_WIDTH, color: colors.foregroundMuted, fontFamily: "monospace", fontSize: FONT_SIZE, lineHeight: 18, textAlign: "right", paddingRight: 8 }} selectable>
              {isMeta ? "" : gutter(line)}
            </Text>
            <Text style={{ color: colorFor(line.kind), fontFamily: "monospace", fontSize: FONT_SIZE, lineHeight: 18, paddingRight: 8 }} selectable>{line.text}</Text>
          </View>;
        })}
        {truncated && <Text style={{ color: colors.statusWarning, fontFamily: "monospace", fontSize: FONT_SIZE, padding: 8 }}>{"[内容过长，已截断]"}</Text>}
  </View>;
  return <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface1, overflow: "hidden" }}>
    {maxHeight ? <ScrollView style={{ maxHeight }} nestedScrollEnabled><ScrollView horizontal>{body}</ScrollView></ScrollView> : <ScrollView horizontal>{body}</ScrollView>}
  </View>;
}
