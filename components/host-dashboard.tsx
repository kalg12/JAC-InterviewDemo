"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { joinCode, questions } from "@/lib/questions";
import type { SessionPayload } from "@/lib/types";

async function fetchSession(): Promise<SessionPayload> {
  const response = await fetch("/api/session", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("No se pudo leer la sesion.");
  }

  return response.json();
}

export function HostDashboard() {
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [qrSrc, setQrSrc] = useState("");
  const [error, setError] = useState("");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/play?code=${joinCode}`);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await fetchSession();
        if (active) {
          setPayload(data);
        }
      } catch (sessionError) {
        if (active && sessionError instanceof Error) {
          setError(sessionError.message);
        }
      }
    };

    load();
    const interval = window.setInterval(load, 1800);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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

  const totalResponses = payload?.stats.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const isFinalQuestion = (payload?.session.currentQuestion ?? 0) === questions.length - 1;
  const showFinalBoard = isFinalQuestion && payload?.session.phase === "reveal";

  async function sendAction(action: "next" | "reveal" | "reset") {
    const response = await fetch("/api/session/control", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "No se pudo actualizar la sesion." }));
      setError(data.error ?? "No se pudo actualizar la sesion.");
      return;
    }

    setError("");
    const data = await fetchSession();
    setPayload(data);
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
          <button className="button" onClick={() => sendAction("next")}>
            Siguiente pregunta
          </button>
          <button className="ghost-button" onClick={() => sendAction("reveal")}>
            Revelar respuesta
          </button>
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
            {currentQuestion.options.map((option) => {
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
            <span className="question-pill">Cierre de la experiencia</span>
            <h2 className="question-title">Resumen final del pulso JAC</h2>
            <p className="muted">
              Al cerrar la ultima pregunta, esta grafica muestra cuantas respuestas cayeron en la
              opcion esperada en cada bloque del recorrido.
            </p>

            <div className="final-chart">
              {payload?.finalSummary.map((item, index) => {
                const width =
                  item.totalResponses === 0 ? 0 : (item.correctResponses / item.totalResponses) * 100;

                return (
                  <div className="final-chart-row" key={item.questionId}>
                    <div className="final-chart-label">
                      <span className="final-chart-index">0{index + 1}</span>
                      <div>
                        <strong>{item.prompt}</strong>
                        <p className="muted small">
                          {item.correctResponses} de {item.totalResponses || 0} eligieron la opcion esperada
                        </p>
                      </div>
                    </div>
                    <div className="final-chart-bar">
                      <div className="final-chart-fill" style={{ width: `${width}%` }} />
                      <span className="final-chart-value">{Math.round(width)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
          {currentQuestion.options.map((option) => (
            <span className="pill" key={option.id}>
              {option.emoji} {option.mood}
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}
