import Link from "next/link";
import { joinCode, questions } from "@/lib/questions";

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="content">
        <section className="hero">
          <div className="hero-card">
            <span className="eyebrow">Experiencia interactiva para presentacion</span>
            <h1 className="title">JAC Live Pulse</h1>
            <p className="lead">
              Una dinamica tipo escenario en vivo: la audiencia entra con QR, captura su nombre,
              responde con caritas y emociones en lugar de palomitas o taches, y tu ves el pulso de
              la sala en tiempo casi real.
            </p>

            <div className="cta-row">
              <Link className="button" href={`/play?code=${joinCode}`}>
                Entrar como participante
              </Link>
              <Link className="ghost-button" href="/host">
                Abrir vista de presentador
              </Link>
            </div>
          </div>

          <div className="metrics-grid">
            <article className="metric">
              <strong>{questions.length}</strong>
              <span>preguntas cargadas</span>
            </article>
            <article className="metric">
              <strong>QR + nombre</strong>
              <span>acceso rapido desde el celular</span>
            </article>
            <article className="metric">
              <strong>Emoji UI</strong>
              <span>reacciones visuales en vez de quiz tradicional</span>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
