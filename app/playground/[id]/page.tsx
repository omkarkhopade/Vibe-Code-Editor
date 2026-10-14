"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import LoadingStep from "@/modules/playground/components/loader";
import {PlaygroundEditor} from "@/modules/playground/components/playground-editor";
import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";
import ToggleAI from "@/modules/playground/components/toggle-ai";
import { useAISuggestions } from "@/modules/playground/hooks/useAISuggestion";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import { usePlayground } from "@/modules/playground/hooks/usePlayground";
import { updateFilesByPath } from "@/modules/playground/lib";
import {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";
import WebContainerPreview from "@/modules/webcontainers/components/webcontainer-preview";
import { useWebContainer } from "@/modules/webcontainers/hooks/useWebContainer";
import { AlertCircle, FileText, FolderOpen, Save, Settings, X } from "lucide-react";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const MainPlaygroundPage = () => {
  const { id } = useParams<{ id: string }>();
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const { playgroundData, templateData, isLoading, error, saveTemplateData } =
    usePlayground(id);

    const aiSuggestions = useAISuggestions();

  const {
    setTemplateData,
    setActiveFileId,
    setPlaygroundId,
    setOpenFiles,
    activeFileId,
    closeAllFiles: discardAllFiles,
    closeFile: discardFile,
    openFile,
    openFiles,

    handleAddFile,
    handleAddFolder,
    handleDeleteFile,
    handleDeleteFolder,
    handleRenameFile,
    handleRenameFolder,
    updateFileContent
  } = useFileExplorer();

  const {
    serverUrl,
    isLoading: containerLoading,
    error: containerError,
    instance,
    writeFileSync,
  } = useWebContainer({ templateData, playgroundId: id });

  const lastSyncedContent = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setPlaygroundId(id);
  }, [id, setPlaygroundId]);

  useEffect(() => {
    if (templateData && !openFiles.length) {
      setTemplateData(templateData);
    }
  }, [templateData, setTemplateData, openFiles.length]);

  // Create wrapper functions that pass saveTemplateData
  const wrappedHandleAddFile = useCallback(
    (newFile: TemplateFile, parentPath: string) => {
      return handleAddFile(
        newFile,
        parentPath,
        writeFileSync!,
        instance,
        saveTemplateData
      );
    },
    [handleAddFile, writeFileSync, instance, saveTemplateData]
  );

  const wrappedHandleAddFolder = useCallback(
    (newFolder: TemplateFolder, parentPath: string) => {
      return handleAddFolder(newFolder, parentPath, instance, saveTemplateData);
    },
    [handleAddFolder, instance, saveTemplateData]
  );

  const wrappedHandleDeleteFile = useCallback(
    (file: TemplateFile, parentPath: string) => {
      return handleDeleteFile(file, parentPath, saveTemplateData);
    },
    [handleDeleteFile, saveTemplateData]
  );

  const wrappedHandleDeleteFolder = useCallback(
    (folder: TemplateFolder, parentPath: string) => {
      return handleDeleteFolder(folder, parentPath, saveTemplateData);
    },
    [handleDeleteFolder, saveTemplateData]
  );

  const wrappedHandleRenameFile = useCallback(
    (
      file: TemplateFile,
      newFilename: string,
      newExtension: string,
      parentPath: string
    ) => {
      return handleRenameFile(
        file,
        newFilename,
        newExtension,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFile, saveTemplateData]
  );

  const wrappedHandleRenameFolder = useCallback(
    (folder: TemplateFolder, newFolderName: string, parentPath: string) => {
      return handleRenameFolder(
        folder,
        newFolderName,
        parentPath,
        saveTemplateData
      );
    },
    [handleRenameFolder, saveTemplateData]
  );

  const activeFile = openFiles.find((file) => file.id === activeFileId);
  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);
  // Preview uses current buffers; durable persistence still requires Save / Save All.
  const previewTemplate = useMemo(() => templateData ? updateFilesByPath(templateData,
    new Map(openFiles.filter(file => file.hasUnsavedChanges).map(file => [file.id, file.content]))) : null,
    [templateData, openFiles]);
  const closeFile = (fileId: string) => { const file = useFileExplorer.getState().openFiles.find(file => file.id === fileId); if (!file?.hasUnsavedChanges || window.confirm("Discard unsaved changes in " + file.id + "?")) discardFile(fileId); };
  const closeAllFiles = () => { if (!hasUnsavedChanges || window.confirm("Discard all unsaved changes?")) discardAllFiles(); };
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (useFileExplorer.getState().openFiles.some(file => file.hasUnsavedChanges)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const handleFileSelect = (file: TemplateFile) => {
    openFile(file);
  };

  const saving = useRef(false);
  const handleSave = useCallback(async (fileId?: string) => {
    if (saving.current) return;
    const snapshot = useFileExplorer.getState();
    if (!snapshot.templateData) return;
    const targets = fileId === "*" ? snapshot.openFiles.filter(file => file.hasUnsavedChanges) : snapshot.openFiles.filter(file => file.id === (fileId || snapshot.activeFileId));
    if (!targets.length) return;
    saving.current = true;
    try {
      const updates = new Map(targets.map(file => [file.id, file.content]));
      const updated = updateFilesByPath(snapshot.templateData, updates);
      await saveTemplateData(updated);
      if (useFileExplorer.getState().playgroundId !== id) return;
      setTemplateData(updated);
      setOpenFiles(useFileExplorer.getState().openFiles.map(file => {
        const saved = updates.get(file.id);
        return saved === undefined ? file : { ...file, originalContent: saved, hasUnsavedChanges: file.content !== saved };
      }));
      if (instance) {
        try {
          for (const file of targets) { await writeFileSync(file.id, file.content); lastSyncedContent.current.set(file.id, file.content); }
        } catch { toast.error("Changes saved, but preview synchronization failed. Reload the preview."); }
      }
    } catch { toast.error("Failed to save changes. Your edits are still open."); }
    finally { saving.current = false; }
  }, [id, instance, saveTemplateData, setTemplateData, setOpenFiles, writeFileSync]);
  const handleSaveAll = () => handleSave("*");


  useEffect(()=>{
    const handleKeyDown = (e:KeyboardEvent)=>{
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
        e.preventDefault()
        void handleSave(e.shiftKey ? "*" : undefined).catch(() => {});
      }
    }
     window.addEventListener("keydown", handleKeyDown);
     return () => window.removeEventListener("keydown", handleKeyDown);
  },[handleSave]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-red-600 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="destructive">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <div className="w-full max-w-md p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-6 text-center">
            Loading Playground
          </h2>
          <div className="mb-8">
            <LoadingStep
              currentStep={1}
              step={1}
              label="Loading playground data"
            />
            <LoadingStep
              currentStep={2}
              step={2}
              label="Setting up environment"
            />
            <LoadingStep currentStep={3} step={3} label="Ready to code" />
          </div>
        </div>
      </div>
    );
  }

  // No template data
  if (!templateData) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-4">
        <FolderOpen className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-amber-600 mb-2">
          No template data available
        </h2>
        <Button onClick={() => window.location.reload()} variant="outline">
          Reload Template
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <>
        <TemplateFileTree
          data={templateData!}
          onFileSelect={handleFileSelect}
          selectedFile={activeFile}
          title="File Explorer"
          onAddFile={wrappedHandleAddFile}
          onAddFolder={wrappedHandleAddFolder}
          onDeleteFile={wrappedHandleDeleteFile}
          onDeleteFolder={wrappedHandleDeleteFolder}
          onRenameFile={wrappedHandleRenameFile}
          onRenameFolder={wrappedHandleRenameFolder}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />

            <div className="flex flex-1 items-center gap-2">
              <div className="flex flex-col flex-1">
                <h1 className="text-sm font-medium">
                  {playgroundData?.title || "Code Playground"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {openFiles.length} File(s) Open
                  {hasUnsavedChanges && " • Unsaved changes"}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Save file" onClick={() => handleSave()}
                      disabled={!activeFile || !activeFile.hasUnsavedChanges}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save (Ctrl+S)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Save all files" onClick={handleSaveAll}
                      disabled={!hasUnsavedChanges}
                    >
                      <Save className="h-4 w-4" /> All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save All (Ctrl+Shift+S)</TooltipContent>
                </Tooltip>

               <ToggleAI activeSource={activeFile ? { path: activeFile.id, content: activeFile.content } : undefined}
                isEnabled={aiSuggestions.isEnabled}
                onToggle={aiSuggestions.toggleEnabled}
                suggestionLoading={aiSuggestions.isLoading}
               />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" aria-label="Editor actions">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href="/dashboard" onClick={event => { if (hasUnsavedChanges && !window.confirm("Discard unsaved changes and return to dashboard?")) event.preventDefault(); }}>Back to dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/settings" onClick={event => { if (hasUnsavedChanges && !window.confirm("Discard unsaved changes and open Settings?")) event.preventDefault(); }}>Settings</Link></DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                    >
                      {isPreviewVisible ? "Hide" : "Show"} Preview
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={closeAllFiles}>
                      Close All Files
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <div className="h-[calc(100vh-4rem)]">
            {openFiles.length > 0 ? (
              <div className="h-full flex flex-col">
                <div className="border-b bg-muted/30">
                  <Tabs
                    value={activeFileId || ""}
                    onValueChange={setActiveFileId}
                  >
                    <div className="flex items-center justify-between px-4 py-2">
                      <TabsList className="h-8 bg-transparent p-0">
                        {openFiles.map((file) => (
                          <TabsTrigger
                            key={file.id}
                            value={file.id}
                            className="relative h-8 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm group"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              <span>
                                {file.filename}{file.fileExtension ? "." + file.fileExtension : ""}
                              </span>
                              {file.hasUnsavedChanges && (
                                <span className="h-2 w-2 rounded-full bg-orange-500" />
                              )}
                              <span
                                role="button" tabIndex={0} aria-label={"Close " + file.id} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); closeFile(file.id); } }}
                                className="ml-2 h-4 w-4 hover:bg-destructive hover:text-destructive-foreground rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeFile(file.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </span>
                            </div>
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {openFiles.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={closeAllFiles}
                          className="h-6 px-2 text-xs"
                        >
                          Close All
                        </Button>
                      )}
                    </div>
                  </Tabs>
                </div>
                <div className="flex-1">
                  <ResizablePanelGroup
                    orientation="horizontal"
                    className="h-full"
                  >
                    <ResizablePanel defaultSize={isPreviewVisible ? "50%" : "100%"}>
                      <PlaygroundEditor filePath={activeFile ? `${id}/${activeFile.id}` : undefined}
                        suggestionError={aiSuggestions.error}
                        activeFile={activeFile}
                        content={activeFile?.content || ""}
                        onContentChange={(value) => 
                          activeFileId && updateFileContent(activeFileId , value)
                        }
                        suggestion={aiSuggestions.suggestion}
                        suggestionLoading={aiSuggestions.isLoading}
                        suggestionPosition={aiSuggestions.position}
                        onAcceptSuggestion={(editor , monaco)=>aiSuggestions.acceptSuggestion(editor , monaco)}

                          onRejectSuggestion={(editor) =>
                          aiSuggestions.rejectSuggestion(editor)
                        }
                        onTriggerSuggestion={(type, editor) =>
                          aiSuggestions.fetchSuggestion(type, editor)
                        }
                      />
                    </ResizablePanel>

                    {isPreviewVisible && (
                      <>
                        <ResizableHandle />
                        <ResizablePanel defaultSize="50%">
                          <WebContainerPreview key={id}
                            templateData={previewTemplate || templateData}
                            hasUnsavedChanges={hasUnsavedChanges}
                            instance={instance}
                            writeFileSync={writeFileSync}
                            isLoading={containerLoading}
                            error={containerError}
                            serverUrl={serverUrl!}
                            forceResetup={false}
                          />
                        </ResizablePanel>
                      </>
                    )}
                  </ResizablePanelGroup>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-muted-foreground gap-4">
                <FileText className="h-16 w-16 text-gray-300" />
                <div className="text-center">
                  <p className="text-lg font-medium">No files open</p>
                  <p className="text-sm text-gray-500">
                    Select a file from the sidebar to start editing
                  </p>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>
      </>
    </TooltipProvider>
  );
};

export default MainPlaygroundPage;
