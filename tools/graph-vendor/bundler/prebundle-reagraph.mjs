// Prebundles reagraph (+three, fiber, drei, react-dom) with host React kept external.
// usage: node prebundle-reagraph.mjs <dir with node_modules containing reagraph> [output client/vendor dir]
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
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
