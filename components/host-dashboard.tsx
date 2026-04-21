"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { getShuffledOptions, joinCode, questions } from "@/lib/questions";
import type { SessionControlPayload, SessionPayload } from "@/lib/types";

async function fetchSession(): Promise<SessionPayload> {
  const response = await fetch("/api/session", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("No se pudo leer la sesion.");
  }

  return response.json();
}

async function sendSessionAction(action: "next" | "reveal" | "reset" | "end") {
  const response = await fetch("/api/session/control", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "No se pudo actualizar la sesion." }));
    throw new Error(data.error ?? "No se pudo actualizar la sesion.");
  }

  return (await response.json()) as SessionControlPayload;
}

export function HostDashboard() {
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [endedPayload, setEndedPayload] = useState<SessionPayload | null>(null);
  const [qrSrc, setQrSrc] = useState("");
  const [error, setError] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const isPollingRef = useRef(false);
  const endLocked = endedPayload !== null;

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/play?code=${joinCode}`);
  }, []);

  useEffect(() => {
    if (endLocked) {
      return;
    }

    let active = true;

    const load = async () => {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        const data = await fetchSession();
        if (active) {
          setPayload(data);
          setError("");
        }
      } catch (sessionError) {
        if (active && sessionError instanceof Error) {
          setError(sessionError.message);
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    load();
    const interval = window.setInterval(load, 700);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [endLocked]);

  useEffect(() => {
    if (!joinUrl) {
      return;
    }

    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: "#06111f",
        light: "#f7fbff"
      }
    }).then(setQrSrc);
  }, [joinUrl]);

  const currentQuestion = useMemo(() => {
    if (!payload) {
      return questions[0];
    }

    return questions[payload.session.currentQuestion] ?? questions[0];
  }, [payload]);
  const currentOptions = useMemo(() => getShuffledOptions(currentQuestion), [currentQuestion]);

  const totalResponses = payload?.stats.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const isFinalQuestion = (payload?.session.currentQuestion ?? 0) === questions.length - 1;
  const showFinalBoard =
    isFinalQuestion && (payload?.session.phase === "reveal" || payload?.session.phase === "ended");
  const sessionEnded = payload?.session.phase === "ended";
  const sessionPhase = payload?.session.phase ?? "lobby";

  useEffect(() => {
    if (payload?.session.phase === "ended") {
      setEndedPayload(payload);
    }
  }, [payload]);

  async function sendAction(action: "next" | "reveal" | "reset" | "end") {
    try {
      const data = await sendSessionAction(action);
      setError("");
      if (action === "reset") {
        setEndedPayload(null);
      }
      setPayload(data.payload);
    } catch (sessionError) {
      if (sessionError instanceof Error) {
        setError(sessionError.message);
      }
    }
  }

  async function advanceHostFlow() {
    if (!payload || sessionEnded) {
      return;
    }

    if (isFinalQuestion && sessionPhase === "reveal") {
      await sendAction("end");
      return;
    }

    if (sessionPhase === "question") {
      await sendAction("reveal");
      return;
    }

    if (!isFinalQuestion) {
      await sendAction("next");
    }
  }

  const primaryActionLabel = isFinalQuestion
    ? sessionPhase === "reveal"
      ? "Terminar actividad"
      : "Revelar respuesta final"
    : sessionPhase === "reveal"
      ? "Siguiente pregunta"
      : "Revelar respuesta";

  if (sessionEnded || endedPayload) {
    return (
      <div className="host-grid">
        <section className="panel">
          <span className="eyebrow">Actividad cerrada</span>
          <h2>{payload?.session.title ?? endedPayload?.session.title ?? "JAC Live Pulse"}</h2>
          <p className="muted">
            La dinámica ya terminó y esta vista final queda fija para el presentador. Los participantes ya se quedaron en su pantalla de resultado final.
          </p>

          <div className="metrics-grid" style={{ marginTop: 18 }}>
            <article className="metric">
              <strong>{payload?.participants.length ?? endedPayload?.participants.length ?? 0}</strong>
              <span>participantes registrados</span>
            </article>
            <article className="metric">
              <strong>{questions.length}</strong>
              <span>preguntas completadas</span>
            </article>
            <article className="metric">
              <strong>Finalizada</strong>
              <span>sesión congelada en cierre</span>
            </article>
          </div>

          <div className="participant-summary-state" style={{ marginTop: 24 }}>
            <span className="tag">Cierre estable</span>
            <p className="muted">
              Esta pantalla no mostrará gráficas finales ni regresará a la pregunta 1. Se mantendrá en este cierre hasta que decidas reiniciar la demo.
            </p>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="ghost-button" onClick={() => sendAction("reset")}>
              Reiniciar demo
            </button>
          </div>

          {error ? (
            <p className="footer-note">
              <span className="tag danger">Atencion</span> {error}
            </p>
          ) : null}
        </section>

        <aside className="panel">
          <h3>Cierre de presentación</h3>
          <p className="muted small">
            El escenario ya quedó congelado en la pantalla final. Si vas a iniciar otra dinámica, usa el botón de reinicio cuando estés listo.
          </p>
        </aside>
      </div>
    );
  }

  return (
    <div className="host-grid">
      <section className="panel">
        <span className="eyebrow">Pantalla del escenario</span>
        <h2>{payload?.session.title ?? "Cargando..."}</h2>
        <p className="muted">
          La audiencia entra con el codigo <strong>{joinCode}</strong>, deja su nombre y responde
          desde el celular. Esta vista te sirve para proyectar y controlar el flujo.
        </p>

        <div className="status-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginTop: 16 }}>
          <div className="metric">
            <strong>{payload?.participants.length ?? 0}</strong>
            <span>personas conectadas</span>
          </div>
          <div className="metric">
            <strong>{totalResponses}</strong>
            <span>respuestas en esta ronda</span>
          </div>
          <div className="metric">
            <strong>{(payload?.session.currentQuestion ?? 0) + 1}</strong>
            <span>pregunta actual</span>
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!sessionEnded ? (
            <button className="button" onClick={advanceHostFlow}>
              {primaryActionLabel}
            </button>
          ) : null}
          <button className="ghost-button" onClick={() => sendAction("reset")}>
            Reiniciar demo
          </button>
        </div>

        <div className="question-card" style={{ marginTop: 20 }}>
          <span className="question-pill">
            Pulso {payload ? payload.session.currentQuestion + 1 : 1} de {questions.length}
          </span>
          <h2 className="question-title">{currentQuestion.prompt}</h2>

          <div className="stats-bar">
            {currentOptions.map((option) => {
              const count = payload?.stats.find((item) => item.optionId === option.id)?.count ?? 0;
              const width = totalResponses === 0 ? 0 : (count / totalResponses) * 100;
              const isCorrect =
                payload?.session.phase === "reveal" && option.id === currentQuestion.correctOptionId;

              return (
                <div className="bar" key={option.id}>
                  <div className="bar-fill" style={{ width: `${width}%` }} />
                  <div className="bar-content">
                    <span>
                      {option.emoji} {option.label}
                    </span>
                    <span>
                      {count} {isCorrect ? "• respuesta estrella" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showFinalBoard ? (
          <div className="question-card finale-card" style={{ marginTop: 20 }}>
            <span className="question-pill">Listo para cerrar</span>
            <h2 className="question-title">Última pregunta completada</h2>
            <p className="muted">
              Si todo está listo, usa <strong>Terminar actividad</strong> para congelar la pantalla final del presentador y dejar a cada participante en su cierre definitivo.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="footer-note">
            <span className="tag danger">Atencion</span> {error}
          </p>
        ) : null}
      </section>

      <aside className="panel">
        <h3>Ingreso con QR</h3>
        <div className="qr-frame">
          {qrSrc ? <img src={qrSrc} alt="QR para entrar al quiz" width={260} height={260} /> : "Generando QR..."}
        </div>
        <p className="footer-note">
          URL de acceso: <strong>{joinUrl || "Cargando enlace..."}</strong>
        </p>

        <h3 style={{ marginTop: 22 }}>Concepto visual</h3>
        <p className="muted small">
          En lugar de correcto o incorrecto con iconografia clasica, cada opcion tiene una carita o
          gesto. Al revelar, la respuesta correcta se marca como la “respuesta estrella”.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          {currentOptions.map((option) => (
            <span className="pill" key={option.id}>
              {option.emoji} {option.mood}
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}
