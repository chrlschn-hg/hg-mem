// Prebundles reagraph (+three, fiber, drei, react-dom) with host React kept external.
// usage: node prebundle-reagraph.mjs <dir with node_modules containing reagraph> [output client/vendor dir]
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
const dir = process.argv[2];
const out = process.argv[3] ?? `${dir}/client/vendor`;
mkdirSync(out, { recursive: true });
await build({
  stdin: { contents: 'export * from "reagraph";\n', resolveDir: dir },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2020",
  minify: true,
  external: ["react", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: `${out}/reagraph-vendor.js`,
  logLevel: "info",
  legalComments: process.env.LEGAL ? "external" : "none",
});
const fromRoot = createRequire(resolve(dir, "package.json"));
const fromGraph = createRequire(fromRoot.resolve("reagraph"));
const version = (name) => {
  let directory = dirname((name === "react" || name === "react-dom" ? fromRoot : fromGraph).resolve(name));
  while (directory !== dirname(directory)) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (pkg.name === name) return pkg.version;
    } catch {}
    directory = dirname(directory);
  }
  throw new Error(`Cannot resolve version of ${name}`);
};
const metadataPath = `${out}/reagraph-vendor.meta.json`;
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
for (const name of ["reagraph", "@react-three/fiber", "@react-three/drei", "three", "graphology"]) {
  metadata[name] = version(name);
}
metadata["react-dom (private, inlined)"] = version("react-dom");
metadata.requiresHostReact = version("react");
metadata.sha1 = createHash("sha1").update(readFileSync(`${out}/reagraph-vendor.js`)).digest("hex");
metadata.builtAt = new Date().toISOString().slice(0, 10);
writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
