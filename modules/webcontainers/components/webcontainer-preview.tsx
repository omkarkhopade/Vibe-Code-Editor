"use client";

import React, { useEffect, useState, useRef } from "react";

import { syncSource } from "../hooks/sync-source";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent, { type TerminalRef } from "./terminal";

interface WebContainerPreviewProps {

  templateData: TemplateFolder;
  hasUnsavedChanges?: boolean;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup

}
const WebContainerPreview = ({
  templateData,
  hasUnsavedChanges = false,
  error,
  instance,
  isLoading,
  forceResetup = false,
}: WebContainerPreviewProps) => {
  const [restart, setRestart] = useState(0);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const terminalRef = useRef<TerminalRef | null>(null);
  const initialTemplate = useRef(templateData);
  const mountedSource = useRef<TemplateFolder | null>(null);
  const syncQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!instance) return;
    let disposed = false;
    const timer = setTimeout(() => {
      syncQueue.current = syncQueue.current.catch(() => {}).then(async () => {
        if (disposed) return;
        await syncSource(instance, mountedSource.current, templateData);
        mountedSource.current = templateData;
      }).catch(() => { if (!disposed) setSetupError("Preview could not synchronize your edits. Retry the preview."); });
    }, 300);
    return () => { disposed = true; clearTimeout(timer); };
  }, [instance, templateData]);
  useEffect(() => {
    if (!instance) return;
    let disposed = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const processes: WebContainerProcess[] = [];
    const off = instance.on("server-ready", (_port, url) => {
      if (!disposed) { timers.forEach(clearTimeout); setSetupError(null); setPreviewUrl(url); setCurrentStep(4); }
    });
    let recentOutput = "";
    const write = (data: string) => {
      if (disposed) return;
      terminalRef.current?.writeToTerminal(data);
      recentOutput = (recentOutput + data).slice(-4096);
      if (recentOutput.includes("[nodemon] app crashed")) {
        recentOutput = "";
        setSetupError("The application crashed; its development watcher is still running. Check the startup error in the terminal below.");
      }
    };
    async function run(command: string[]) {
      const process = await instance!.spawn("npm", command);
      if (disposed) { process.kill(); return null; }
      processes.push(process);
      void process.output.pipeTo(new WritableStream({ write })).catch(() => {});
      return process;
    }
    async function setup() {
      try {
        const source = initialTemplate.current;
        syncQueue.current = syncQueue.current.catch(() => {}).then(async () => {
          if (disposed) return;
          await syncSource(instance!, mountedSource.current, source);
          mountedSource.current = source;
        });
        await syncQueue.current;
        if (disposed) return;
        setPreviewUrl(""); setSetupError(null); setCurrentStep(3);
        write("Installing dependencies...\r\n");
        const install = await run(["install"]);
        if (!install) return;
        const exit = await Promise.race([install.exit, new Promise<never>((_, reject) => { timers.push(setTimeout(() => { install.kill(); reject(new Error("Dependency installation timed out. Check registry access and retry.")); }, 180000)); })]);
        if (disposed) return;
        if (exit !== 0) throw new Error("Dependency installation failed");
        setCurrentStep(4);
        const manifest = JSON.parse(await instance!.fs.readFile("package.json", "utf8"));
        const script = manifest.scripts?.dev ? "dev" : "start";
        const server = await run(["run", script]);
        if (server) {
          timers.push(setTimeout(() => { if (!disposed) setSetupError("Server has not exposed a preview port. Check its start script and terminal output, then retry."); }, 90000));
          const code = await server.exit;
          timers.forEach(clearTimeout);
          if (!disposed) { setPreviewUrl(""); setSetupError(`Development server stopped (exit ${code}). Check its script and restart.`); }
        }
      } catch (failure) {
        if (!disposed) setSetupError(failure instanceof Error ? failure.message : "Preview setup failed");
      }
    }
    void setup();
    return () => { disposed = true; timers.forEach(clearTimeout); off(); processes.forEach(process => process.kill()); };
  }, [instance, forceResetup, restart]);

  const retry = () => {
    if (error) { window.location.reload(); return; }
    initialTemplate.current = templateData;
    setRestart(value => value + 1);
  };
  const reload = async () => {
    if (!instance) return;
    try {
      syncQueue.current = syncQueue.current.catch(() => {}).then(async () => {
        await syncSource(instance, mountedSource.current, templateData);
        mountedSource.current = templateData;
      });
      await syncQueue.current;
      setPreviewRevision(value => value + 1);
    } catch { setSetupError("Preview could not synchronize your edits. Retry the preview."); }
  };
  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex flex-wrap gap-2 border-b p-2">
        <Button size="sm" variant="outline" disabled={!instance} onClick={retry}>Restart server</Button>
        <Button size="sm" variant="ghost" disabled={!previewUrl} onClick={() => void reload()}>Reload preview</Button>
      </div>
      {hasUnsavedChanges && <p role="status" className="border-b px-3 py-2 text-xs text-muted-foreground">Preview includes unsaved edits. Use Save All to keep them after reopening.</p>}
      <div className="flex-1 min-h-0 overflow-auto">
        {error || setupError ? (
          <div className="m-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-5 space-y-3">
            <h3 className="font-semibold flex gap-2 items-center"><XCircle className="h-5 w-5" />Preview could not start</h3>
            <p className="text-sm">{error || setupError}</p>
            <p className="text-sm">The terminal below keeps the startup output. Check for missing environment variables, unavailable services or unsupported native dependencies. An API needs to start a listening server before it can show a response.</p>
            <Button variant="outline" onClick={retry}>Retry preview</Button>
          </div>
        ) : isLoading ? (
          <div className="p-6 flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />Initializing WebContainer</div>
        ) : previewUrl ? (
          <iframe key={previewRevision} src={previewUrl} className="w-full h-full border-none" title="WebContainer Preview" />
        ) : (
          <div className="max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 mx-auto">
            <Progress value={(currentStep / totalSteps) * 100} className="h-2 mb-6" />
            <div className="space-y-4">{["Transforming template data", "Mounting files", "Installing dependencies", "Starting development server"].map((label, index) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                {index + 1 < currentStep ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Loader2 className={index + 1 === currentStep ? "h-5 w-5 animate-spin" : "h-5 w-5 text-muted-foreground"} />}{label}
              </div>
            ))}</div>
          </div>
        )}
      </div>
      {instance && <div className="h-64 shrink-0 border-t">
        <TerminalComponent ref={terminalRef} webContainerInstance={instance} theme="dark" className="h-full" />
      </div>}
    </div>
  );
};
export default WebContainerPreview;
