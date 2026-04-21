import { PlayerShell } from "@/components/player-shell";

export default function PlayPage() {
  return (
    <main className="page-shell">
      <div className="content" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <PlayerShell />
      </div>
    </main>
  );
}
