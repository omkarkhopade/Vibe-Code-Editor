import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
// Serve the installed editor version from our own origin instead of a mismatched CDN version.
const destination = path.resolve("public/monaco/vs");
await mkdir(destination, { recursive: true });
await cp(path.resolve("node_modules/monaco-editor/min/vs"), destination, { recursive: true });
console.log("Prepared local Monaco assets");
