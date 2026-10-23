import { useRef } from "react";
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

// Scroll offsets by pane key. A pane that is covered and shown again remounts, so its saved offset is restored.
export type ScrollMemory = Map<string, number>;

export function useRestoredScroll(memory: ScrollMemory, key: string) {
  const ref = useRef<ScrollView>(null);
  const restored = useRef(false);
  return {
    ref,
    onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
      memory.set(key, event.nativeEvent.contentOffset.y);
    },
    // Restores once the content has a height, which is when a remounted list can scroll.
    onContentSizeChange(_width: number, height: number) {
      if (restored.current || height <= 0) return;
      restored.current = true;
      const y = memory.get(key);
      if (y) ref.current?.scrollTo({ y, animated: false });
    },
  };
}
