import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AutoStock", template: "%s · AutoStock" },
  description: "Gestion de stock de pièces automobiles",
  applicationName: "AutoStock",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="top-right" richColors closeButton toastOptions={{ classNames: { toast: "!rounded-lg !border !border-line !shadow-popover !text-[13px]" } }} />
      </body>
    </html>
  );
}
