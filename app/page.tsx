import { Dashboard } from "@/app/components/Dashboard";
import { getCachedDashboardFixtures } from "@/lib/live-fixtures";

export default async function Home() {
  const bootstrap = await getCachedDashboardFixtures();

  return (
    <Dashboard fixtures={bootstrap.fixtures} />
  );
}
