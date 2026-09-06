"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isNavActive, NAV_ICONS, type NavItem } from "./nav-config";
import { ROLE_LABELS } from "@/lib/stock";
import type { Role } from "@/lib/permissions";
import { Avatar } from "@/components/ui/misc";

export function SidebarNav({ items, counts, onNavigate }: { items: NavItem[]; counts?: Record<string, number>; onNavigate?: () => void }) {
  const pathname = usePathname();
  let lastSection: string | undefined;
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isNavActive(item, pathname);
        const showSection = item.section && item.section !== lastSection;
        lastSection = item.section;
        const count = counts?.[item.href];
        const Icon = NAV_ICONS[item.icon];
        return (
          <React.Fragment key={item.href}>
            {showSection ? <p className="mb-1 mt-4 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted first:mt-2">{item.section}</p> : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-8.5 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-ring",
                active ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-sidebar-hover hover:text-white",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-brand-300" : "text-sidebar-muted group-hover:text-white")} />
              <span className="flex-1 truncate">{item.label}</span>
              {count ? <span className={cn("rounded-full px-1.5 py-px font-mono text-[10.5px] tabular", active ? "bg-white/15 text-white" : "bg-warning-600/20 text-warning-600")}>{count}</span> : null}
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, user, counts, company }: { items: NavItem[]; user: { fullName: string; role: Role }; counts?: Record<string, number>; company: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/5 bg-sidebar lg:flex">
      <div className="flex h-14 items-center px-4">
        <Logo variant="light" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 [scrollbar-width:thin]">
        <SidebarNav items={items} counts={counts} />
      </div>
      <div className="border-t border-white/5 p-3">
        <Link href="/profil" className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-sidebar-hover focus-ring">
          <Avatar name={user.fullName} size="sm" className="bg-white/10 text-white" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-white">{user.fullName}</span>
            <span className="block truncate text-[11px] text-sidebar-muted">
              {ROLE_LABELS[user.role]} · {company}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
