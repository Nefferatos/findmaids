import Link from "next/link";
import { Container } from "@/components/site";

export default function NotFound() {
  return (
    <Container className="grid min-h-[55vh] place-items-center py-16">
      <section className="max-w-xl text-center">
        <p className="text-primary text-sm font-bold uppercase">404</p>
        <h1 className="font-display mt-2 text-3xl font-bold">Page not found</h1>
        <p className="text-muted-foreground mt-3">
          The page may have moved or the address may be incorrect.
        </p>
        <Link
          href="/"
          className="bg-primary mt-6 inline-flex min-h-11 items-center px-4 font-bold text-white"
        >
          Return home
        </Link>
      </section>
    </Container>
  );
}
