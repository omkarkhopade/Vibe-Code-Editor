"use client";
import { useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { parsePreferences, preferencesSchema, type Preferences } from "./preferences";
const event = "vibe-preferences";
function subscribe(callback: () => void) {
  window.addEventListener(event, callback); window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
export function usePreferences() {
  const { data } = useSession();
  const key = data?.user?.id ? "vibe-preferences:" + data.user.id : null;
  const raw = useSyncExternalStore(subscribe, () => { try { return key ? localStorage.getItem(key) : null; } catch { return null; } }, () => null);
  const preferences = parsePreferences(raw);
  function savePreferences(values: Preferences) {
    if (!key) throw new Error("Sign in to save preferences");
    localStorage.setItem(key, JSON.stringify(preferencesSchema.parse(values)));
    window.dispatchEvent(new Event(event));
  }
  return { preferences, savePreferences };
}
