import Link from "next/link";
import { RegisterForm } from "@/components/forms";
import { Container } from "@/components/site";

export const metadata = {
  title: "Create an account | FindMaids",
  description: "Create an employer or agency account.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return (
    <Container className="grid min-h-[65vh] max-w-xl place-items-center py-12">
      <section className="w-full rounded-md border bg-white p-6 sm:p-8">
        <p className="text-primary text-sm font-bold uppercase">
          Join FindMaids
        </p>
        <h1 className="font-display mt-2 mb-6 text-3xl font-bold">
          Create an account
        </h1>
        <RegisterForm
          initialAccountType={type === "agency" ? "agency" : "employer"}
        />
        <p className="mt-5 text-sm">
          Already registered?{" "}
          <Link className="text-primary font-bold underline" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </Container>
  );
}
