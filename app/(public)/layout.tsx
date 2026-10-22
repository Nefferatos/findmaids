import type { ReactNode } from "react";
import { SiteShell } from "@/components/site";
import { ToastProvider } from "@/components/toast-provider";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell>
      {children}
      <ToastProvider />
    </SiteShell>
  );
}
