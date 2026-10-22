import { FaqPage } from "@/components/content-pages";
export const metadata = {
  title: "Frequently asked questions | FindMaids",
  description:
    "Answers about FindMaids agency listings, enquiries, and reviews.",
  openGraph: {
    title: "FindMaids FAQ",
    description: "Learn how FindMaids works.",
  },
};
export default function FaqRoute() {
  return <FaqPage />;
}
