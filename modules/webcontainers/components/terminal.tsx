"use client";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";


import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Copy, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

  const terminalThemes = {
    dark: {
      background: "#09090B",
      foreground: "#FAFAFA",
      cursor: "#FAFAFA",
      cursorAccent: "#09090B",
      selection: "#27272A",
      black: "#18181B",
      red: "#EF4444",
      green: "#22C55E",
      yellow: "#EAB308",
      blue: "#3B82F6",
      magenta: "#A855F7",
      cyan: "#06B6D4",
      white: "#F4F4F5",
      brightBlack: "#3F3F46",
      brightRed: "#F87171",
      brightGreen: "#4ADE80",
      brightYellow: "#FDE047",
      brightBlue: "#60A5FA",
      brightMagenta: "#C084FC",
      brightCyan: "#22D3EE",
      brightWhite: "#FFFFFF",
    },
    light: {
      background: "#FFFFFF",
      foreground: "#18181B",
      cursor: "#18181B",
      cursorAccent: "#FFFFFF",
      selection: "#E4E4E7",
      black: "#18181B",
      red: "#DC2626",
      green: "#16A34A",
      yellow: "#CA8A04",
      blue: "#2563EB",
      magenta: "#9333EA",
      cyan: "#0891B2",
      white: "#F4F4F5",
      brightBlack: "#71717A",
      brightRed: "#EF4444",
      brightGreen: "#22C55E",
      brightYellow: "#EAB308",
      brightBlue: "#3B82F6",
      brightMagenta: "#A855F7",
      brightCyan: "#06B6D4",
      brightWhite: "#FAFAFA",
    },
  };

interface TerminalProps {
  webcontainerUrl?: string;
  className?: string;
  theme?: "dark" | "light";
  webContainerInstance?: WebContainer | null;
}

// Define the methods that will be exposed through the ref
export interface TerminalRef {
  writeToTerminal: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
}

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({
  className,
  theme = "dark",
  webContainerInstance
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const clearTerminal = useCallback(() => term.current?.clear(), [])
  useImperativeHandle(ref, () => ({
    writeToTerminal: data => term.current?.write(data),
    clearTerminal,
    focusTerminal: () => term.current?.focus(),
  }), [clearTerminal])

  useEffect(() => {
    if (!terminalRef.current) return
    let disposed = false
    let shell: WebContainerProcess | null = null
    let input: WritableStreamDefaultWriter<string> | null = null
    const terminal = new Terminal({ cursorBlink: true, fontFamily: 'Consolas, monospace', fontSize: 14,
      theme: terminalThemes[theme], convertEol: true, scrollback: 1000 })
    const fit = new FitAddon()
    const search = new SearchAddon()
    terminal.loadAddon(fit)
    terminal.loadAddon(search)
    terminal.loadAddon(new WebLinksAddon())
    terminal.open(terminalRef.current)
    term.current = terminal
    fitAddon.current = fit
    searchAddon.current = search
    const resize = () => {
      if (disposed) return
      fit.fit()
      shell?.resize({ cols: terminal.cols, rows: terminal.rows })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(terminalRef.current)
    const inputListener = terminal.onData(data => {
      if (input) void input.write(data).catch(() => { if (!disposed) setIsConnected(false) })
    })
    setIsConnected(false)
    // Keep shell parsing, stdin, history and Ctrl+C inside the browser runtime.
    async function connect() {
      if (!webContainerInstance) return
      try {
        const process = await webContainerInstance.spawn('jsh', { terminal: { cols: terminal.cols, rows: terminal.rows } })
        if (disposed) { process.kill(); return }
        shell = process
        input = process.input.getWriter()
        setIsConnected(true)
        void process.output.pipeTo(new WritableStream({ write: data => { if (!disposed) terminal.write(data) } })).catch(() => {})
        await process.exit
        if (!disposed) { setIsConnected(false); terminal.writeln('\r\nShell stopped. Restart the preview to reconnect.') }
      } catch {
        if (!disposed) { setIsConnected(false); terminal.writeln('\r\nCould not start the browser shell. Restart the preview to retry.') }
      }
    }
    void connect()
    return () => {
      disposed = true
      observer.disconnect()
      inputListener.dispose()
      shell?.kill()
      input?.releaseLock()
      terminal.dispose()
      term.current = null
      fitAddon.current = null
      searchAddon.current = null
    }
  }, [theme, webContainerInstance])

  const copyTerminalContent = useCallback(async () => {
    if (term.current) {
      const content = term.current.getSelection();
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
          toast.success("Terminal selection copied");
        } catch {
          toast.error("Could not copy terminal selection");
        }
      } else { toast.error("Select terminal text to copy first"); }
    }
  }, []);

  const downloadTerminalLog = useCallback(() => {
    if (term.current) {
      const buffer = term.current.buffer.active;
      let content = "";

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          content += line.translateToString(true) + "\n";
        }
      }

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terminal-log-${new Date().toISOString().slice(0, 19)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const searchInTerminal = useCallback((term: string) => {
    if (searchAddon.current && term) {
      searchAddon.current.findNext(term);
    }
  }, []);

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg overflow-hidden", className)}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-sm font-medium">WebContainer Terminal</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchInTerminal(e.target.value);
                }}
                className="h-6 w-32 text-xs"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            aria-label="Search terminal" onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0"
          >
            <Search className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Copy terminal selection" onClick={copyTerminalContent}
            className="h-6 w-6 p-0"
          >
            <Copy className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Download terminal log" onClick={downloadTerminalLog}
            className="h-6 w-6 p-0"
          >
            <Download className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            aria-label="Clear terminal" onClick={clearTerminal}
            className="h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 relative">
        <div 
          ref={terminalRef} 
          className="absolute inset-0 p-2"
          style={{ 
            background: terminalThemes[theme].background,
          }}
        />
      </div>
    </div>
  );
});

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;