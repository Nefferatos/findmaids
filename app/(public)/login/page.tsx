import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms";
import { Container } from "@/components/site";

export const metadata = {
  title: "Log in | FindMaids",
  description: "Log in to your FindMaids account.",
};

export default function LoginPage() {
  return (
    <Container className="grid min-h-[65vh] max-w-xl place-items-center py-12">
      <section className="w-full rounded-md border bg-white p-6 sm:p-8">
        <p className="text-primary text-sm font-bold uppercase">Welcome back</p>
        <h1 className="font-display mt-2 text-3xl font-bold">
          Log in to FindMaids
        </h1>
        <p className="text-muted-foreground mt-2 mb-6 text-sm">
          Verify your email before using password login.
        </p>
        <Suspense fallback={<p>Loading sign-in…</p>}>
          <LoginForm />
        </Suspense>
        <div className="mt-5 flex justify-between gap-4 text-sm">
          <Link className="underline" href="/forgot-password">
            Forgot password?
          </Link>
          <Link className="underline" href="/register">
            Create account
          </Link>
        </div>
      </section>
    </Container>
  );
}
