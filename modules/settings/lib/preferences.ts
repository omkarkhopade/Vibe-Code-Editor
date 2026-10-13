import { z } from "zod";
export const preferencesSchema = z.object({
  fontSize: z.number().int().min(10).max(28).default(14),
  tabSize: z.number().int().min(1).max(8).default(2),
  wordWrap: z.enum(["on", "off"]).default("on"),
  model: z.string().max(200).default(""),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = preferencesSchema.parse({});
export function parsePreferences(raw: string | null): Preferences {
  try { const result = preferencesSchema.safeParse(JSON.parse(raw || "{}")); return result.success ? result.data : defaultPreferences; }
  catch { return defaultPreferences; }
}
