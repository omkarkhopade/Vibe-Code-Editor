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

interface NewFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFile: (filename: string, extension: string) => void;
}

function NewFileDialog({ isOpen, onClose, onCreateFile }: NewFileDialogProps) {
  const [filename, setFilename] = React.useState("");
  const [extension, setExtension] = React.useState("js");

  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; setBusy(true); setFailure(null);
    try {
    if (filename.trim()) {
      await onCreateFile(filename.trim(), extension.trim());
      setFilename("");
      setExtension("js");
    }
    } catch { setFailure("Could not save this change. Your input has been kept; try again."); } finally { setBusy(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { if (!busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>
            Enter a name for the new file and select its extension.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="filename" className="text-right">
                Filename
              </Label>
              <Input
                id="filename"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="col-span-2"
                autoFocus
                placeholder="main"
              />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="extension" className="text-right">
                Extension
              </Label>
              <Input
                id="extension"
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="col-span-2"
                placeholder="js"
              />
            </div>
          </div>
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !filename.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NewFileDialog;   