import type { PluginTheme } from "@getpaseo/plugin";
import { StyleSheet } from "react-native";

export function createStyles(theme: PluginTheme, compact: boolean) {
  const { colors } = theme;
  const pad = compact ? 16 : 24;
  // Touch-sized controls on compact layouts, denser controls on desktop.
  const control = compact ? 44 : 36;
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.surface0,
      paddingHorizontal: pad,
      paddingTop: compact ? 12 : 16,
    },
    title: { color: colors.foreground, fontSize: 20, fontWeight: "600", lineHeight: 26 },
    heading: { color: colors.foreground, fontSize: 16, fontWeight: "600", lineHeight: 22 },
    sectionTitle: { color: colors.foreground, fontSize: 13, fontWeight: "600", lineHeight: 18 },
    paragraph: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
    text: { color: colors.foreground, fontSize: 15, lineHeight: 21 },
    muted: { color: colors.foregroundMuted, fontSize: 13, lineHeight: 18 },
    label: { color: colors.foregroundMuted, fontSize: 13, fontWeight: "500", lineHeight: 18 },
    danger: { color: colors.statusDanger, fontSize: 14, lineHeight: 20 },
    success: { color: colors.statusSuccess, fontSize: 15, fontWeight: "600", lineHeight: 21 },
    rowTitle: { color: colors.foreground, fontSize: 15, fontWeight: "600", lineHeight: 20 },
    badgeText: { color: colors.foregroundMuted, fontSize: 12, fontWeight: "600" },
    chipText: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
    segmentText: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
    primaryText: { color: colors.accentForeground, fontSize: 14, fontWeight: "600" },
    secondaryText: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
    linkText: { color: colors.foreground, fontSize: 14, fontWeight: "500" },
    disabledText: { color: colors.foregroundMuted, fontSize: 14, fontWeight: "500" },
    input: {
      minHeight: control,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface2,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.foreground,
      fontSize: 15,
    },
    inputMultiline: { minHeight: 140, textAlignVertical: "top" },
    primary: {
      height: control,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    secondary: {
      height: control,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface1,
    },
    link: { height: control, justifyContent: "center" },
    chip: {
      minHeight: control,
      paddingHorizontal: 12,
      borderRadius: 8,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface1,
    },
    chipActive: { borderColor: colors.accent, backgroundColor: colors.surface2 },
    // Segmented tabs read as navigation: one bordered track, the selected segment raised.
    segmented: {
      flexDirection: "row",
      alignSelf: compact ? "stretch" : "flex-start",
      flexBasis: compact ? "100%" : "auto",
      gap: 2,
      padding: 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface1,
    },
    segment: {
      height: control - 4,
      // Three modes need a row of their own on a compact panel. New memory follows on the next, aligned row.
      flexGrow: compact ? 1 : 0,
      minWidth: compact ? 0 : 112,
      paddingHorizontal: compact ? 8 : 14,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: { backgroundColor: colors.surface2 },
    disabled: { opacity: 0.5 },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface1,
      padding: 12,
      gap: 8,
    },
    rowItem: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 4,
      borderLeftWidth: 2,
      borderLeftColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // The accent edge is part of the row border, so selecting a row never shifts its text.
    rowItemSelected: { backgroundColor: colors.surface1, borderLeftColor: colors.accent },
    // Tabs on the left and New memory on the right, divided from the panes below.
    toolbarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: compact ? "wrap" : "nowrap",
      gap: 12,
      paddingBottom: 12,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // Stacked header: identity and New memory on one row, the view tabs on the row beneath, divided from the panes below.
    headerStack: { gap: 12, paddingBottom: 12, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    // Identity and New memory share one row at every width. Identity gives up width first, so the button stays beside it.
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    // Primary tabs and New memory as one right-aligned group beside the identity in the merged header.
    actionGroup: { flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 12 },
    // List | Graph: one grouped track. Its segments fill the track, and the track is the 36/44 control height.
    viewTrack: {
      flexDirection: "row",
      alignSelf: "flex-start",
      padding: 2,
      gap: 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface1,
    },
    viewSegment: { minWidth: 64, paddingHorizontal: 14, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    viewSegmentActive: { backgroundColor: colors.surface2 },
    // Text kept for assistive technology and not drawn. The Layout announcement uses it.
    visuallyHidden: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" },
    // Detail header: badges or the back control on the left, Close on the right.
    detailTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
      minHeight: control,
    },
    // Create footer: wide panes keep Save and Cancel together with Clear draft apart; narrow panes stack Save full width.
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    fullWidth: { alignSelf: "stretch" },
    // Summary row: bordered above and below so the required inventory reads as its own section.
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minHeight: control,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    stack: { gap: 12 },
    field: { gap: 6 },
    // Each section is divided from the one above it, with a visible title.
    section: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
    // A callout above a historical record's content, stating what the record is before its text.
    banner: { gap: 4, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface1 },
    bannerTitle: { color: colors.foreground, fontSize: 14, fontWeight: "600", lineHeight: 20 },
    // A filing path: named levels on one wrapping line, separated by muted arrows.
    crumbRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    stateBlock: { gap: 8, paddingVertical: 12 },
    pager: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: 8,
    },
    listPane: { flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" },
    detailPane: {
      flex: 1.2,
      minHeight: 0,
      minWidth: 0,
      overflow: "hidden",
      paddingLeft: 16,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    split: { flex: 1, minHeight: 0, flexDirection: "row", gap: 16 },
    // With the graph, the inspector takes 42% of the split row, capped at 380. It clips to its own box, so its content
    // cannot paint over the graph pane or the toolbar.
    detailPaneBounded: {
      width: "42%",
      maxWidth: 380,
      minWidth: 0,
      flexShrink: 0,
      minHeight: 0,
      overflow: "hidden",
      paddingLeft: 16,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    fill: { flex: 1, minHeight: 0 },
    hidden: { display: "none" },
    scroll: { flex: 1, minHeight: 0 },
    scrollContent: { gap: 12, paddingBottom: 24 },
    // Focus rings sit just outside a field, and a scroll box clips at its edges. The form's box reaches 4px into the
    // padding and its content takes the same 4px back, so labels and fields keep their place and the ring is visible.
    formScroll: { marginHorizontal: -4 },
    formContent: { paddingHorizontal: 4 },
    // The shared toolbar: search, the view switch, and the disclosure triggers, one row that wraps on compact.
    commandRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 },
    searchField: { flexGrow: 1, flexBasis: compact ? "100%" : 180, minWidth: 0 },
    // A bounded in-flow disclosure directly under the toolbar. Its list scrolls within its own height.
    disclosure: {
      gap: 4,
      padding: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface1,
      marginBottom: 8,
    },
    // On compact the canvas fills the remaining graph viewport, with a minimum height so it stays usable.
    graphCanvasCompactFill: { minHeight: 280 },
    // The graph canvas fills the remaining results viewport, with a minimum height it asks for.
    graphCanvas: { flex: 1, minHeight: 360, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  });
}

export type MemoryStyles = ReturnType<typeof createStyles>;
