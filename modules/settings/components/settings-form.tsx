"use client";
import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreferences } from "../lib/use-preferences";
import { updateProfile } from "../actions";
import Link from "next/link";

export default function SettingsForm({ profile }: { profile: { name: string | null; email: string; accounts: { provider: string }[] } }) {
  const [name, setName] = useState(profile.name || "");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState("Checking GitHub connection...");
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [aiStatus, setAiStatus] = useState("Checking Ollama...");
  const [revision, setRevision] = useState(0);
  const { preferences, savePreferences } = usePreferences();
  const { update } = useSession(); const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    async function load(path: string) { const response = await fetch(path, { signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Service unavailable"); return data; }
    void load("/api/github/connection").then(data => { if (!controller.signal.aborted) setConnection(data.status === "connected" ? `Connected as ${data.login}` : data.status === "disconnected" ? "GitHub is not connected" : "GitHub needs reauthorization"); }).catch(error => { if (!controller.signal.aborted) setConnection(error.message); });
    void load("/api/ai/models").then(data => { if (!controller.signal.aborted) { setModels(data.models); setDefaultModel(data.defaultModel); setAiStatus(data.models.length ? "Ollama is available" : "No installed models are permitted"); } }).catch(error => { if (!controller.signal.aborted) { setModels([]); setAiStatus(error.message); } });
    return () => controller.abort();
  }, [revision]);
  function changePreferences(values: typeof preferences) {
    try { savePreferences(values); toast.success("Preference saved in this browser"); }
    catch { toast.error("Preference could not be saved. Check browser storage permissions."); }
  }
  return <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
    <div><Link className="text-sm text-muted-foreground hover:underline" href="/dashboard">Back to dashboard</Link><h1 className="text-2xl font-semibold mt-3">Settings</h1></div>
    <section className="border rounded-lg bg-muted p-6 space-y-4"><h2 className="text-lg font-semibold">Profile</h2>
      <p className="text-sm text-muted-foreground">{profile.email} · Linked providers: {profile.accounts.map(account => account.provider).join(", ") || "None"}</p>
      <form className="space-y-3" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); try { await updateProfile({ name }); await update(); router.refresh(); toast.success("Profile saved"); } catch { toast.error("Profile could not be saved. Try again."); } finally { setBusy(false); } }}>
        <Label htmlFor="profile-name">Display name</Label><Input id="profile-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
        <Button disabled={busy || !name.trim()}>{busy ? "Saving..." : "Save profile"}</Button>
      </form>
    </section>
    <section className="border rounded-lg bg-muted p-6 space-y-4"><h2 className="text-lg font-semibold">GitHub connection</h2>
      <p role="status" className="text-sm">{connection}</p>
      <p className="text-sm text-muted-foreground">Connect while signed in to link GitHub to this account. Reconnect with the same GitHub identity to replace revoked credentials. Accounts belonging to another user cannot be linked.</p>
      <p className="text-sm text-muted-foreground">Public imports require no repository permissions. Private imports require an existing authorization that permits that repository. GitHub OAuth has no read-only private-repository scope, so this app does not request the broad write-enabled repo scope.</p>
      <Button onClick={() => void signIn("github", { redirectTo: "/settings" })}>Connect / reconnect GitHub</Button>
      <p className="text-xs text-muted-foreground">To revoke GitHub access, use GitHub Settings → Applications. This does not delete your editor account. Provider unlinking is unavailable to prevent accidental account lockout.</p>
    </section>
    <section className="border rounded-lg bg-muted p-6 space-y-4"><h2 className="text-lg font-semibold">AI preferences</h2>
      <p role="status" className="text-sm">{aiStatus}</p><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Refresh connection status</Button>
      <div className="space-y-2"><Label htmlFor="preferred-model">Chat model</Label><select id="preferred-model" className="block w-full rounded-md border bg-background p-2 text-sm" value={preferences.model} onChange={event => changePreferences({ ...preferences, model: event.target.value })}>
        <option value="">Server default{defaultModel ? ` (${defaultModel})` : ""}</option>
        {preferences.model && !models.includes(preferences.model) && <option value={preferences.model}>{preferences.model} (unavailable)</option>}
        {models.map(model => <option key={model}>{model}</option>)}
      </select></div><p className="text-xs text-muted-foreground">Installed Ollama models only. Completion uses the server default. An unavailable selection is never silently replaced.</p>
    </section>
    <section className="border rounded-lg bg-muted p-6 space-y-4"><h2 className="text-lg font-semibold">Editor preferences</h2>
      <p className="text-sm text-muted-foreground">These preferences are saved for your account in this browser and apply to Monaco immediately. Source files use explicit Save / Save All.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(["fontSize", "tabSize"] as const).map(key => <div key={key} className="space-y-2"><Label htmlFor={key}>{key === "fontSize" ? "Font size" : "Tab size"}</Label><select id={key} className="w-full rounded-md border bg-background p-2 text-sm" value={preferences[key]} onChange={event => changePreferences({ ...preferences, [key]: Number(event.target.value) })}>{(key === "fontSize" ? Array.from({ length: 19 }, (_, i) => i + 10) : Array.from({ length: 8 }, (_, i) => i + 1)).map(size => <option key={size}>{size}</option>)}</select></div>)}</div>
      <Label className="flex items-center gap-2"><input type="checkbox" checked={preferences.wordWrap === "on"} onChange={event => changePreferences({ ...preferences, wordWrap: event.target.checked ? "on" : "off" })} />Word wrap</Label>
    </section>
    <section className="border rounded-lg bg-muted p-6 space-y-4"><h2 className="text-lg font-semibold">Account</h2><Button variant="outline" onClick={() => void signOut({ redirectTo: "/" })}>Sign out</Button></section>
  </div>;
}
