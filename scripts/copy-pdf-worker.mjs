import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// pdf.js renders the pages in the browser, so its worker must be served from
// our own origin (the CSP forbids third-party workers). Run after upgrading
// pdfjs-dist.
const source = join(
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const target = join("public", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
