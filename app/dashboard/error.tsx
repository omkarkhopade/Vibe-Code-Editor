"use client";
import { Button } from "@/components/ui/button";
export default function DashboardError({ reset }: { reset: () => void }) {
  return <div role="alert" className="mx-auto max-w-lg p-8 space-y-4"><h1 className="text-xl font-semibold">Could not load your account</h1><p className="text-muted-foreground">Your data has not been changed. Check your connection and try again.</p><Button onClick={reset}>Try again</Button></div>;
}
