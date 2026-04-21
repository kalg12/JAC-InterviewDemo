import { BackgroundAudio } from "@/components/background-audio";
import { HostDashboard } from "@/components/host-dashboard";

export default function HostPage() {
  return (
    <main className="page-shell">
      <div className="content">
        <HostDashboard />
      </div>
      <BackgroundAudio />
    </main>
  );
}
