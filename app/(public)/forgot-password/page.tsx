import { ForgotPasswordForm } from "@/components/forms";
import { Container } from "@/components/site";

export const metadata = {
  title: "Reset password | FindMaids",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Container className="grid min-h-[60vh] max-w-xl place-items-center py-12">
      <section className="w-full rounded-md border bg-white p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold">
          Forgot your password?
        </h1>
        <p className="text-muted-foreground my-4 text-sm leading-6">
          Enter your account email. If it matches, we’ll send a reset link.
        </p>
        <ForgotPasswordForm />
      </section>
    </Container>
  );
}
