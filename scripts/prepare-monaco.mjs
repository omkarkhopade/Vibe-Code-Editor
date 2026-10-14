import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
// Serve the installed editor version from our own origin instead of a mismatched CDN version.
const destination = path.resolve("public/monaco/vs");
await mkdir(destination, { recursive: true });
await cp(path.resolve("node_modules/monaco-editor/min/vs"), destination, { recursive: true });
await cp(path.resolve("node_modules/monaco-editor/LICENSE"), path.resolve("public/monaco/LICENSE"));
// Monaco 0.57.0's accessibility announcement awaits a cancelable delay without
// handling cancellation (inlineCompletionsController.js, lines 305-314). Rapid
// acceptance/disposal rejects that async listener. Patch only those two awaits
// in the copied assets; preserve accessibility and rethrow unexpected failures.
// Fail on version/content changes so upgrades require reviewing/removing this.
const { version } = JSON.parse(await readFile("node_modules/monaco-editor/package.json", "utf8"));
if (version !== "0.57.0") throw new Error("Review Monaco cancellation workaround for version " + version);
const bundle = (await readdir(destination)).find(name => /^toggleHighContrast-.*\.js$/.test(name));
if (!bundle) throw new Error("Monaco inline completion bundle not found");
const bundlePath = path.join(destination, bundle);
const original = await readFile(bundlePath, "utf8");
const before = 'if(!y||!C||(await a.timeout(50,a.cancelOnDispose(b)),await o.waitForState(this._suggestWidgetAdapter.selectedItem,a.isUndefined,()=>!1,a.cancelOnDispose(b)),C=this.model.get(),y=C?.state.get(),!y||!C))return;';
const after = 'if(!y||!C)return;try{await a.timeout(50,a.cancelOnDispose(b));await o.waitForState(this._suggestWidgetAdapter.selectedItem,a.isUndefined,()=>!1,a.cancelOnDispose(b))}catch(error){if(error?.name==="Canceled")return;throw error}C=this.model.get();y=C?.state.get();if(!y||!C)return;';
if (original.split(before).length !== 2) throw new Error("Monaco cancellation workaround no longer matches exactly once");
await writeFile(bundlePath, original.replace(before, after));
console.log("Prepared local Monaco assets");
