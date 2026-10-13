import { createHash } from "node:crypto";
export function sourceRevision(content: string | null | undefined) { return content == null ? null : createHash("sha256").update(content).digest("hex"); }
