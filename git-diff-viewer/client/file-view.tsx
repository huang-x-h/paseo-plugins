import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

const FONT_SIZE = 12;
const CHAR_WIDTH = FONT_SIZE * 0.6;
const GUTTER_CHARS = 4 + 1;
const GUTTER_WIDTH = Math.round(GUTTER_CHARS * CHAR_WIDTH) + 8;

export function FileContentView({ content, truncated, totalLines, theme }: { content: string; truncated: boolean; totalLines: number; theme: PluginTheme }) {
  const colors = theme.colors;
  const lines = useMemo(() => content.split("\n"), [content]);
  return <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, backgroundColor: colors.surface1, overflow: "hidden" }}>
    <ScrollView horizontal>
      <View style={{ minWidth: GUTTER_WIDTH + 40 }}>
        {lines.map((line, index) => <View key={index} style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Text numberOfLines={1} style={{ width: GUTTER_WIDTH, flexShrink: 0, color: colors.foregroundMuted, fontFamily: "monospace", fontSize: FONT_SIZE, lineHeight: 18, textAlign: "right", paddingRight: 8 }} selectable>
            {index + 1}
          </Text>
          <Text style={{ flexShrink: 0, color: colors.foreground, fontFamily: "monospace", fontSize: FONT_SIZE, lineHeight: 18, paddingRight: 8 }} selectable>{line}</Text>
        </View>)}
        {truncated && <Text style={{ color: colors.statusWarning, fontFamily: "monospace", fontSize: FONT_SIZE, padding: 8 }}>{`文件共 ${totalLines} 行，仅显示前 ${lines.length} 行`}</Text>}
      </View>
    </ScrollView>
  </View>;
}
