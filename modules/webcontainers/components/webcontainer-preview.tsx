"use client";

import React, { useEffect, useState, useRef } from "react";

import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent, { type TerminalRef } from "./terminal";

interface WebContainerPreviewProps {

  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean; // Optional prop to force re-setup

}
const WebContainerPreview = ({
  templateData,
  error,
  instance,
  isLoading,
  forceResetup = false,
}: WebContainerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const terminalRef = useRef<TerminalRef | null>(null);
  const initialTemplate = useRef(templateData);
  useEffect(() => {
    if (!instance) return;
    let disposed = false;
    const processes: WebContainerProcess[] = [];
    const off = instance.on("server-ready", (_port, url) => {
      if (!disposed) { setPreviewUrl(url); setCurrentStep(4); }
    });
    const write = (data: string) => { if (!disposed) terminalRef.current?.writeToTerminal(data); };
    async function run(command: string[]) {
      const process = await instance!.spawn("npm", command);
      if (disposed) { process.kill(); return null; }
      processes.push(process);
      void process.output.pipeTo(new WritableStream({ write })).catch(() => {});
      return process;
    }
    async function setup() {
      try {
        const files = transformToWebContainerFormat(initialTemplate.current);
        await instance!.mount(files);
        if (disposed) return;
        setPreviewUrl(""); setSetupError(null); setCurrentStep(2);
        write("Installing dependencies...\r\n");
        const install = await run(["install"]);
        if (!install) return;
        const exit = await install.exit;
        if (disposed) return;
        if (exit !== 0) throw new Error("Dependency installation failed");
        setCurrentStep(3);
        const manifest = JSON.parse(await instance!.fs.readFile("package.json", "utf8"));
        const script = manifest.scripts?.dev ? "dev" : "start";
        const server = await run(["run", script]);
        if (server) {
          const code = await server.exit;
          if (!disposed && code !== 0) setSetupError("Development server exited unexpectedly");
        }
      } catch (failure) {
        if (!disposed) setSetupError(failure instanceof Error ? failure.message : "Preview setup failed");
      }
    }
    void setup();
    return () => { disposed = true; off(); processes.forEach(process => process.kill()); };
  }, [instance, forceResetup]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-medium">Initializing WebContainer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Setting up the environment for your project...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="text-sm">{error || setupError}</p>
        </div>
      </div>
    );
  }
  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span
        className={`text-sm font-medium ${
          isComplete
            ? "text-green-600"
            : isActive
            ? "text-blue-600"
            : "text-gray-500"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      {!previewUrl ? (
        <div className="h-full flex flex-col">
          <div className="w-full max-w-md p-6 m-5 rounded-lg bg-white dark:bg-zinc-800 shadow-sm mx-auto">
            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2 mb-6"
            />

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                {getStepIcon(1)}
                {getStepText(1, "Transforming template data")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(2)}
                {getStepText(2, "Mounting files")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(3)}
                {getStepText(3, "Installing dependencies")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(4)}
                {getStepText(4, "Starting development server")}
              </div>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 p-4">
            <TerminalComponent
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="flex-1">
            <iframe
              src={previewUrl}
              className="w-full h-full border-none"
              title="WebContainer Preview"
            />
          </div>

          <div className="h-64 border-t">
            <TerminalComponent
              ref={terminalRef}
              webContainerInstance={instance}
              theme="dark"
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;
