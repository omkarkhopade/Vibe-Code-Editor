import { redirect } from "next/navigation";
import { currentUser } from "@/modules/auth/actions";
import { db } from "@/lib/db";
import SettingsForm from "@/modules/settings/components/settings-form";
export default async function SettingsPage() {
  const user = await currentUser();
  if (!user?.id) redirect("/auth/sign-in");
  const profile = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, accounts: { select: { provider: true } } } });
  if (!profile) redirect("/auth/sign-in");
  return <SettingsForm profile={profile} />;
}
