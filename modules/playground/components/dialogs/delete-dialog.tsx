import * as React from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface DeleteDialogProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  title?: string
  description?: string
  itemName?: string
  onConfirm: () => void | Promise<void>
  confirmLabel?: string
  cancelLabel?: string
}

export function DeleteDialog({
  isOpen,
  setIsOpen,
  title = "Delete Item",
  description = "Are you sure you want to delete this item? This action cannot be undone.",
  itemName,
  onConfirm,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: DeleteDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  return (
    <AlertDialog open={isOpen} onOpenChange={open => { if (!busy) setIsOpen(open); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description.replace("{item}", `"${itemName}"`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async event => { event.preventDefault(); if (busy) return; setBusy(true); setFailure(null); try { await onConfirm(); setIsOpen(false); } catch { setFailure("Deletion failed. Nothing was reported as deleted; please retry."); } finally { setBusy(false); } }}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
