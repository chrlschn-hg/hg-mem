// Web-only graph renderer plumbing. Browser globals are declared here and nowhere else in the graph
// view. The vendored Reagraph bundle is evaluated only when loadReagraph() runs, never at import
// time, and never off the web platform.
import { version as hostReactVersion, type ComponentType } from "react";
import { Platform } from "react-native";

declare const require: (id: string) => unknown;
declare const document: { createElement(tag: "canvas"): { getContext(id: string): unknown } };

interface CanvasLike {
  width: number;
  height: number;
}
interface ContainerLike {
  querySelector(selector: string): CanvasLike | null;
  addEventListener(type: string, listener: () => void, capture?: boolean): void;
  removeEventListener(type: string, listener: () => void, capture?: boolean): void;
}
interface LoseContext {
  loseContext(): void;
}

export interface ReagraphModule {
  GraphCanvas: ComponentType<Record<string, unknown>>;
  lightTheme: Record<string, unknown>;
  darkTheme: Record<string, unknown>;
}
export type Outcome<T> = ({ ok: true } & T) | { ok: false; message: string };

// Fault injection for browser tests, passed as an optional prop by a test harness. Production
// callers never pass it.
export type GraphFault = "module" | "nowebgl" | "timeout" | "render-react" | "render-canvas";

export const isWeb = Platform.OS === "web";
export const GRAPH_START_DEADLINE_MS = 8000;
// The vendored bundle carries its own react-dom, which requires the exact React version it was
// built against (see vendor/reagraph-vendor.meta.json). Any other host React falls back.
export const GRAPH_REACT_VERSION = "19.1.0";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function checkWebGL(fault?: GraphFault): Outcome<unknown> {
  if (!isWeb) return { ok: false, message: "The interactive graph is not available on this platform." };
  if (fault === "nowebgl") return { ok: false, message: "WebGL is not available (injected test fault)." };
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return { ok: false, message: "WebGL is not available in this browser or is disabled." };
    // Hand the probe context back so it does not count against the browser's context limit.
    (gl as { getExtension?(name: string): LoseContext | null }).getExtension?.("WEBGL_lose_context")?.loseContext();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `WebGL check failed: ${describe(error)}` };
  }
}

// A module whose evaluation threw is not re-evaluated by the bundler, so a retry in the same
// session reports the earlier failure instead of loading again.
let lastLoadFailure: string | null = null;

export function loadReagraph(fault?: GraphFault): Outcome<{ module: ReagraphModule }> {
  if (!isWeb) return { ok: false, message: "The interactive graph is not available on this platform." };
  try {
    if (fault === "module") throw new Error("injected module failure");
    if (hostReactVersion !== GRAPH_REACT_VERSION) {
      throw new Error(`host React ${hostReactVersion} does not match the graph renderer's React ${GRAPH_REACT_VERSION}`);
    }
    const loaded = require("./vendor/reagraph-vendor.js") as Partial<ReagraphModule> | undefined;
    if (!loaded?.GraphCanvas || !loaded.darkTheme || !loaded.lightTheme) {
      throw new Error(
        lastLoadFailure
          ? `the graph module failed to start earlier in this session (${lastLoadFailure}); reload the plugin to retry`
          : "the graph module did not export the expected renderer",
      );
    }
    lastLoadFailure = null;
    return { ok: true, module: loaded as ReagraphModule };
  } catch (error) {
    lastLoadFailure ??= describe(error);
    return { ok: false, message: `The graph module could not be loaded: ${describe(error)}` };
  }
}

export interface CanvasWatch {
  onReady(): void;
  onLost(): void;
  onTimeout(): void;
}

// Watches one container for a sized canvas (ready), a lost WebGL context (lost, observed in the
// capture phase because the event does not bubble), and a start deadline (timeout). The returned
// cleanup clears the timer and listener, so nothing outlives the canvas.
export function watchCanvas(container: unknown, watch: CanvasWatch, deadlineMs = GRAPH_START_DEADLINE_MS): () => void {
  const node = container as Partial<ContainerLike> | null;
  if (!node?.querySelector || !node.addEventListener || !node.removeEventListener) {
    watch.onTimeout();
    return () => {};
  }
  let ready = false;
  let done = false;
  const lost = () => {
    if (!done) watch.onLost();
  };
  node.addEventListener("webglcontextlost", lost, true);
  const poll = setInterval(() => {
    const canvas = node.querySelector?.("canvas");
    if (!ready && canvas && canvas.width > 0 && canvas.height > 0) {
      ready = true;
      clearInterval(poll);
      clearTimeout(deadline);
      watch.onReady();
    }
  }, 120);
  const deadline = setTimeout(() => {
    if (!ready) {
      clearInterval(poll);
      watch.onTimeout();
    }
  }, deadlineMs);
  return () => {
    done = true;
    clearInterval(poll);
    clearTimeout(deadline);
    node.removeEventListener?.("webglcontextlost", lost, true);
  };
}
