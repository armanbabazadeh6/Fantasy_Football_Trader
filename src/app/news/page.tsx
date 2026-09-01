import { NewsBrowser } from "@/components/news-browser";
import { countArchivedNews, getArchivedNews } from "@/lib/news-archive";
import { fetchNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NFL News",
};

export default async function NewsPage() {
  const archived = await getArchivedNews({ limit: 60 });
  const items = archived.length > 0 ? archived : await fetchNews();
  const archiveTotal = Math.max(countArchivedNews(), items.length);
  return <NewsBrowser items={items} archiveTotal={archiveTotal} />;
}
