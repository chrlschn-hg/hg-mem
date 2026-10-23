import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { SKILL_ASSETS } from "./skill-assets";

const ROOT_SKILL = "memory-workflow/SKILL.md";

/** Absolute path of the Paseo-facing root skill inside an install directory. */
export function rootSkillPath(directory: string): string {
  return path.join(path.resolve(directory), ...ROOT_SKILL.split("/"));
}

function checkedDirectory(directory: string): string {
  if (typeof directory !== "string" || directory.trim() === "" || directory.includes("\0")) {
    throw new Error("skills directory must be a non-empty path");
  }
  if (!path.isAbsolute(directory)) throw new Error("skills directory must be an absolute path");
  const resolved = path.resolve(directory);
  if (resolved === path.parse(resolved).root) throw new Error("refusing to install skills into a filesystem root");
  if (resolved === path.resolve(homedir())) throw new Error("refusing to install skills directly into the home directory");
  return resolved;
}

function assetTarget(base: string, rel: string): string {
  const parts = rel.split("/");
  if (!rel.endsWith(".md") || path.isAbsolute(rel) || parts.some((p) => p === "" || p === "." || p === "..")) {
    throw new Error(`invalid skill asset path: ${rel}`);
  }
  return path.join(base, ...parts);
}

async function writeAtomic(target: string, content: string): Promise<void> {
  try {
    if ((await readFile(target, "utf8")) === content) return; // unchanged: leave file and mtime alone
  } catch {
    // absent or unreadable: write it
  }
  await mkdir(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    const handle = await open(temp, "wx", 0o644);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

/** Writes only the embedded skill files (relative folders preserved) under `directory`; idempotent, atomic per file. */
export async function installSkills(directory: string): Promise<void> {
  const base = checkedDirectory(directory);
  const entries = Object.entries(SKILL_ASSETS).map(([rel, content]) => [assetTarget(base, rel), content] as const);
  await mkdir(base, { recursive: true });
  for (const [target, content] of entries) await writeAtomic(target, content);
}
