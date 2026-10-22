import { Container, SkeletonCard } from "@/components/site";
export default function AgenciesLoading() {
  return (
    <Container className="py-12">
      <div className="bg-muted mb-8 h-10 w-1/2 animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </Container>
  );
}
