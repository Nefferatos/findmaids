"use client";

import { useState } from "react";
import Image from "next/image";
import { maidInitials } from "@/lib/maid-photo";

/**
 * Maid portrait that never renders a broken image.
 *
 * The profile may point at a photo that has since been removed, so a failed load
 * falls back to the maid's initials (the same placeholder the listing cards use).
 * Client-side only for the `onError` handler.
 */
export function MaidPhoto({
  src,
  name,
  sizes,
  priority = false,
  className = "",
  placeholderClassName = "",
}: {
  src: string | null;
  name: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  placeholderClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed)
    return (
      <span className={placeholderClassName} aria-hidden="true">
        {maidInitials(name)}
      </span>
    );

  return (
    <Image
      src={src}
      alt={`${name} profile photo`}
      fill
      sizes={sizes ?? "(min-width: 1024px) 320px, 100vw"}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
