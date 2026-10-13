import { persistOAuthAccount } from "@/modules/auth/lib/persist-oauth-account";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { db } from "./lib/db";
export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  secret: process.env.AUTH_SECRET,
  logger: { error(error) { console.error(JSON.stringify({ event: "auth_error", type: error.name })); } },
  session: { strategy: "jwt" },
  events: { async signIn({ user, account }) { if (user.id) await persistOAuthAccount(user.id, account); } },
  callbacks: {
    // Account creation/linking belongs to the adapter. Never link users solely by email.
    async jwt({ token }) {
      if (!token.sub) return token;
      const user = await db.user.findUnique({ where: { id: token.sub }, select: { name: true, email: true, role: true } });
      if (!user) return null;
      token.name = user.name;
      token.email = user.email;
      token.role = user.role;
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) { session.user.id = token.sub; session.user.role = token.role; }
      return session;
    },
  },
});
