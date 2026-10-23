"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN)
      Sentry.captureException(error, { tags: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center px-4">
        <main className="max-w-lg text-center">
          <h1 className="font-display text-3xl font-bold">
            Service interruption
          </h1>
          <p className="mt-3">Please try again shortly.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="bg-primary mt-6 min-h-11 px-4 font-bold text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
