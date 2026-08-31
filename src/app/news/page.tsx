import { NewsBrowser } from "@/components/news-browser";
import { getArchivedNews } from "@/lib/news-archive";
import { fetchNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NFL News",
};

export default async function NewsPage() {
  const archived = await getArchivedNews({ limit: 300 });
  const items = archived.length > 0 ? archived : await fetchNews();
  return <NewsBrowser items={items} />;
}
