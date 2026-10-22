import { ResetPasswordForm } from "@/components/forms";
import { Container } from "@/components/site";

export const metadata = {
  title: "Choose a new password | FindMaids",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <Container className="grid min-h-[60vh] max-w-xl place-items-center py-12">
      <section className="w-full rounded-md border bg-white p-6 sm:p-8">
        <h1 className="font-display mb-6 text-3xl font-bold">
          Choose a new password
        </h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-red-700">
            This reset link is invalid or incomplete.
          </p>
        )}
      </section>
    </Container>
  );
}
