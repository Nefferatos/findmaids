"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
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
    <main className="mx-auto grid min-h-[55vh] max-w-3xl place-items-center px-4 py-16">
      <section className="text-center">
        <p className="text-sm font-bold text-red-700 uppercase">
          Service interruption
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">
          This page could not load
        </h1>
        <p className="text-muted-foreground mt-3">
          Please try again. Your request has not necessarily been completed.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-primary mt-6 min-h-11 px-4 font-bold text-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
