import type { ReactNode } from "react";
import { SiteShell } from "@/components/site";
import { ToastProvider } from "@/components/toast-provider";
import { ChatWidget } from "@/components/chat-widget";
import { CookieConsent } from "@/components/cookie-consent";
import { MaintenanceBanner } from "@/components/maintenance-banner";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      <MaintenanceBanner message={process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE} />
      {children}
      <ChatWidget />
      <CookieConsent />
      <ToastProvider />
    </SiteShell>
  );
}
