import type { Account } from "next-auth";
import { db } from "@/lib/db";
// Called only after Auth.js has resolved/linked the OAuth identity to this user.
export async function persistOAuthAccount(userId: string, account: Account | null | undefined) {
  if (account?.provider !== "github" || !account.access_token) return;
  const result = await db.account.updateMany({
    where: { userId, provider: "github", providerAccountId: account.providerAccountId },
    data: { access_token: account.access_token, token_type: account.token_type, scope: account.scope, expires_at: account.expires_at ?? null,
      ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}) },
  });
  if (result.count !== 1) throw new Error("GitHub account credentials could not be updated");
}
