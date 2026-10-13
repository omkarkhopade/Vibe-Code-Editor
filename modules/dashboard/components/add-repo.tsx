"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Button } from "@/components/ui/button"
import { ArrowDown, Loader2 } from "lucide-react"
import Image from "next/image"

const AddRepo = () => {
  const [repositories, setRepositories] = useState<{ name: string; url: string; branch: string; private: boolean }[]>([]);
  const [listing, setListing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  async function listRepositories(nextPage = 1) {
    if (listing) return; setListing(true); setError(null);
    try { const response = await fetch("/api/github/repositories?page=" + nextPage); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not list repositories"); setRepositories(data.repositories); setPage(nextPage); setHasNext(data.hasNext); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not list repositories"); } finally { setListing(false); }
  }
  const [open, setOpen] = useState(false);
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const router = useRouter();
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/github/import", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository: repository.trim(), ref: branch.trim() || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Repository import failed");
      toast.success("Imported " + result.files + " files" + (result.skipped ? "; skipped " + result.skipped + " unsupported or excluded files" : ""));
      setOpen(false); router.push("/playground/" + result.id); router.refresh();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Repository import failed");
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return (
    <>
    <div
      role="button" tabIndex={0} aria-haspopup="dialog" aria-label="Open GitHub repository"
      onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(true); } }}
      className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E93F3F]/60 px-6 py-6 flex flex-row justify-between items-center border rounded-lg bg-muted cursor-pointer
      transition-all duration-300 ease-in-out
      hover:bg-background hover:border-[#E93F3F] hover:scale-[1.02]
      shadow-[0_2px_10px_rgba(0,0,0,0.08)]
      hover:shadow-[0_10px_30px_rgba(233,63,63,0.15)]"
    >
      <div className="flex flex-row justify-center items-start gap-4">
        <Button
          aria-label="Open GitHub repository"
          variant={"outline"}
          className="flex justify-center items-center bg-white group-hover:bg-[#fff8f8] group-hover:border-[#E93F3F] group-hover:text-[#E93F3F] transition-colors duration-300"
          size={"icon"}
        >
          <ArrowDown size={30} className="transition-transform duration-300 group-hover:translate-y-1" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-[#e93f3f]">Open Github Repository</h1>
          <p className="text-sm text-muted-foreground max-w-[220px]">Work with your repositories in our editor</p>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <Image
          src={"/github.svg"}
          alt="Open GitHub repository"
          width={150}
          height={150}
          className="transition-transform duration-300 group-hover:scale-110"
        />
      </div>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open GitHub Repository</DialogTitle>
          <DialogDescription>Import a Node.js project into a new playground. Dependencies and project scripts run in your browser sandbox.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Button type="button" variant="outline" disabled={listing || busy} onClick={() => void listRepositories() }>{listing ? "Loading repositories..." : "Browse my GitHub repositories"}</Button>
          {repositories.length > 0 && <><Label htmlFor="github-selection">Authorized repositories</Label><select id="github-selection" className="w-full border rounded-md bg-background p-2 text-sm" value={repository} disabled={busy} onChange={event => { const repo = repositories.find(repo => repo.url === event.target.value); if (repo) { setRepository(repo.url); setBranch(repo.branch); } }}><option value="">Select a repository</option>{repositories.map(repo => <option key={repo.url} value={repo.url}>{repo.name}{repo.private ? " (private)" : ""}</option>)}</select><div className="flex gap-2"><Button type="button" variant="ghost" disabled={page <= 1 || listing} onClick={() => void listRepositories(page - 1)}>Previous</Button><Button type="button" variant="ghost" disabled={!hasNext || listing} onClick={() => void listRepositories(page + 1)}>Next</Button></div></>}
          <Link href="/settings" className="block text-sm underline">Manage or reconnect GitHub</Link></div>
          <div className="space-y-2"><Label htmlFor="github-repository">Repository URL</Label><Input id="github-repository" type="url" placeholder="https://github.com/owner/repository" value={repository} onChange={event => setRepository(event.target.value)} required disabled={busy} maxLength={300} autoFocus /></div>
          <div className="space-y-2"><Label htmlFor="github-branch">Branch or commit <span className="text-muted-foreground font-normal">(optional)</span></Label><Input id="github-branch" placeholder="Default branch" value={branch} onChange={event => setBranch(event.target.value)} disabled={busy} maxLength={200} /></div>
          <p className="text-xs text-muted-foreground">Requires a root package.json with a dev or start script. Imports up to 200 text files / 4 MB. Binary assets, environment/key files, symlinks and generated folders are excluded. Private repositories require access through your linked GitHub account.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !repository.trim()} className="bg-[#E93F3F] text-white hover:bg-[#d53636]">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? "Importing repository..." : "Import repository"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}

export default AddRepo


