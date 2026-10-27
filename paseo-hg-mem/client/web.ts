import { Platform } from "react-native";

interface SizedElement {
  getBoundingClientRect(): { width: number; height: number };
}
declare const ResizeObserver: undefined | (new (callback: () => void) => {
  observe(element: SizedElement): void;
  disconnect(): void;
});

// Some host portal surfaces do not deliver RN onLayout. Observe the actual web
// element as well; native continues to use onLayout and never touches this API.
export function observePanelSize(node: unknown, onSize: (width: number, height: number) => void): () => void {
  if (Platform.OS !== "web" || !node || typeof ResizeObserver === "undefined") return () => {};
  const element = node as Partial<SizedElement>;
  if (typeof element.getBoundingClientRect !== "function") return () => {};
  const measure = () => {
    const { width, height } = element.getBoundingClientRect!();
    if (width > 0 && height > 0) onSize(width, height);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(element as SizedElement);
  measure();
  return () => observer.disconnect();
}
