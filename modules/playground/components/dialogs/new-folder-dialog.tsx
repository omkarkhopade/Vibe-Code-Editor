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

interface NewFolderDialogProps {
    isOpen: boolean
    onClose: () => void
    onCreateFolder: (folderName: string) => void
  }

  function NewFolderDialog({ isOpen, onClose, onCreateFolder }: NewFolderDialogProps) {
    const [folderName, setFolderName] = React.useState("")
  
    const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
    if (busy) return; setBusy(true); setFailure(null);
    try {
      if (folderName.trim()) {
        await onCreateFolder(folderName.trim())
        setFolderName("")
      }
    } catch { setFailure("Could not save this change. Your input has been kept; try again."); } finally { setBusy(false); }
  };

  return (
      <Dialog open={isOpen} onOpenChange={() => { if (!busy) onClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="foldername" className="text-right">
                  Folder Name
                </Label>
                <Input
                  id="foldername"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="col-span-2"
                  autoFocus
                  placeholder="components"
                />
              </div>
            </div>
            {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !folderName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  export default NewFolderDialog;