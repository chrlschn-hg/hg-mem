import type { ReactNode, RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import type { MemoryStyles } from "./styles";

export function Badge({ styles, text }: { styles: MemoryStyles; text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

// Primary is reserved for the one main action in a view. Secondary is the default button.
// Link is a quiet text action with the same height, so it lines up with buttons in a row.
export function Action({
  styles,
  label,
  onPress,
  tone = "secondary",
  disabled = false,
  focusRef,
}: {
  styles: MemoryStyles;
  label: string;
  onPress(): void;
  tone?: "primary" | "secondary" | "link";
  disabled?: boolean;
  focusRef?: RefObject<View | null>;
}) {
  const container = tone === "primary" ? styles.primary : tone === "secondary" ? styles.secondary : styles.link;
  const text =
    tone === "primary"
      ? styles.primaryText
      : disabled
        ? styles.disabledText
        : tone === "secondary"
          ? styles.secondaryText
          : styles.linkText;
  return (
    <Pressable
      ref={focusRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={tone === "link" ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
      onPress={onPress}
      style={[container, disabled && styles.disabled]}
    >
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}

// Moves keyboard focus to a mounted control and reports whether it could. Native views have no focus(), so this returns
// false there and the caller falls back to another control.
export function focusControl(control: { readonly current: unknown }): boolean {
  const node = control.current as { focus?: () => void } | null;
  if (typeof node?.focus !== "function") return false;
  node.focus();
  return true;
}

// Selectable choice. Segment mode is for the tab control; chip mode is for purpose, scope, and filing choices.
export function Chip({
  styles,
  label,
  selected,
  onPress,
  role = "button",
  disabled = false,
  segment = false,
}: {
  styles: MemoryStyles;
  label: string;
  selected: boolean;
  onPress(): void;
  role?: "button" | "tab";
  disabled?: boolean;
  segment?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      aria-selected={role === "tab" ? selected : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[
        segment ? styles.segment : styles.chip,
        selected && (segment ? styles.segmentActive : styles.chipActive),
        disabled && styles.disabled,
      ]}
    >
      <Text style={segment ? styles.segmentText : styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export function StateBlock({
  styles,
  title,
  body,
  children,
}: {
  styles: MemoryStyles;
  title: string;
  body?: string | null;
  children?: ReactNode;
}) {
  return (
    <View style={styles.stateBlock}>
      <Text style={styles.heading}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

// A callout that states what a record is before its content. Historical records use it.
export function Banner({ styles, title, body }: { styles: MemoryStyles; title: string; body: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

// A named level in a path or relation line. Quiet link text, so it reads as navigation rather than a control.
export function Crumb({ styles, label, onPress }: { styles: MemoryStyles; label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      onPress={onPress}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

// A divided section: a visible title over its content, with a rule above it.
export function Section({ styles, title, children }: { styles: MemoryStyles; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
