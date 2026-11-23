import type { ReactNode } from "react";
import "./maids.css";

/**
 * Maid search pages render inside the shared public SiteShell (same header,
 * tab nav and footer as the landing page and the Maid Agency directory). This
 * layout only scopes the search/result content styles.
 */
export default function MaidsLayout({ children }: { children: ReactNode }) {
  return children;
}
