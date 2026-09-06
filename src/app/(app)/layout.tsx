import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getNotifications } from "@/server/services/dashboard";
import { getSetting } from "@/server/services/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { visibleNavItems } from "@/components/layout/nav-config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const navItems = visibleNavItems(user.role);
  const notifications = getNotifications();
  const company = getSetting("company.name");
  const counts: Record<string, number> = {
    "/stock": notifications.counts.rupture + notifications.counts.faible,
    "/achats": notifications.counts.pendingPurchases,
    "/ventes": notifications.counts.draftSales,
  };

  return (
    <div className="min-h-dvh">
      <Sidebar items={navItems} user={user} counts={counts} company={company} />
      <div className="flex min-h-dvh flex-col lg:pl-60">
        <Topbar user={user} navItems={navItems} notifications={notifications} counts={counts} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
