"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";


interface RenameFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (filename: string, extension: string) => void;
  currentFilename: string;
  currentExtension: string;
}

function RenameFileDialog({
  isOpen,
  onClose,
  onRename,
  currentFilename,
  currentExtension,
}: RenameFileDialogProps) {
  const [filename, setFilename] = React.useState(currentFilename);
  const [extension, setExtension] = React.useState(currentExtension);

  const resetKey = String(isOpen) + currentFilename + "\0" + currentExtension;
  const [previousKey, setPreviousKey] = React.useState(resetKey);
  if (previousKey !== resetKey) {
    setPreviousKey(resetKey);
    if (isOpen) { setFilename(currentFilename); setExtension(currentExtension); }
  }

  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; setBusy(true); setFailure(null);
    try {
    if (filename.trim()) {
      await onRename(filename.trim(), extension.trim());
    }
    } catch { setFailure("Could not save this change. Your input has been kept; try again."); } finally { setBusy(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { if (!busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename File</DialogTitle>
          <DialogDescription>Enter a new name for the file.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="rename-filename" className="text-right">
                Filename
              </Label>
              <Input
                id="rename-filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="col-span-2"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="rename-extension" className="text-right">
                Extension
              </Label>
              <Input
                id="rename-extension"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="col-span-2"
              />
            </div>
          </div>
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !filename.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RenameFileDialog;
