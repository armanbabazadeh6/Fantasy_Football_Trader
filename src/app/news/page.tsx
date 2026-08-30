import { NewsBrowser } from "@/components/news-browser";
import { fetchNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "NFL News",
};

export default async function NewsPage() {
  const news = await fetchNews();
  return <NewsBrowser items={news} />;
}
