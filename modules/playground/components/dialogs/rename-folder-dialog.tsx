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

interface RenameFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (folderName: string) => void;
  currentFolderName: string;
}

function RenameFolderDialog({
  isOpen,
  onClose,
  onRename,
  currentFolderName,
}: RenameFolderDialogProps) {
  const [folderName, setFolderName] = React.useState(currentFolderName);

  const resetKey = String(isOpen) + currentFolderName;
  const [previousKey, setPreviousKey] = React.useState(resetKey);
  if (previousKey !== resetKey) {
    setPreviousKey(resetKey);
    if (isOpen) { setFolderName(currentFolderName); }
  }

  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; setBusy(true); setFailure(null);
    try {
    if (folderName.trim()) {
      await onRename(folderName.trim());
    }
    } catch { setFailure("Could not save this change. Your input has been kept; try again."); } finally { setBusy(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { if (!busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
          <DialogDescription>
            Enter a new name for the folder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="rename-foldername" className="text-right">
                Folder Name
              </Label>
              <Input
                id="rename-foldername"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="col-span-2"
                autoFocus
              />
            </div>
          </div>
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !folderName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RenameFolderDialog;
