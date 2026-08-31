import { WaiverBoard } from "@/components/waiver-board";
import { getTrendingSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Waiver Wire",
};

export default async function WaiverPage() {
  const players = await getTrendingSummaries(30);
  return <WaiverBoard players={players} />;
}
