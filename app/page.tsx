import { Dashboard } from "@/app/components/Dashboard";
import { UPCOMING_FIXTURES } from "@/lib/fixtures";

export default function Home() {
  return <Dashboard fixtures={UPCOMING_FIXTURES} />;
}
