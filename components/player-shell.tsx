"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import type { Participant, ParticipantResultSummary, SessionPayload } from "@/lib/types";

const participantStorageKey = "jac-live-pulse-participant";

function getStoredParticipant(): Participant | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(participantStorageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Participant;
  } catch {
    return null;
  }
}

export function PlayerShell() {
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [name, setName] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultSummary, setResultSummary] = useState<ParticipantResultSummary | null>(null);

  const currentQuestion = useMemo(() => {
    if (!payload) {
      return questions[0];
    }

    return questions[payload.session.currentQuestion] ?? questions[0];
  }, [payload]);

  useEffect(() => {
    setParticipant(getStoredParticipant());
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = await response.json();
        if (active) {
          setPayload(data);
        }
      } catch {
        if (active) {
          setError("No pudimos sincronizar la sesion.");
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
    setSelectedOption("");
    setShowConfetti(false);
  }, [payload?.session.currentQuestion, payload?.session.phase]);

  useEffect(() => {
    if (!participant || !payload) {
      return;
    }

    const exists = payload.participants.some((item) => item.id === participant.id);

    if (!exists && payload.participants.length > 0) {
      window.localStorage.removeItem(participantStorageKey);
      setParticipant(null);
      setSelectedOption("");
    }
  }, [participant, payload]);

  useEffect(() => {
    if (!payload || payload.session.phase !== "reveal" || !selectedOption) {
      return;
    }

    if (selectedOption === currentQuestion.correctOptionId) {
      setShowConfetti(true);
      const timeout = window.setTimeout(() => setShowConfetti(false), 3200);
      return () => window.clearTimeout(timeout);
    }
  }, [currentQuestion.correctOptionId, payload, selectedOption]);

  useEffect(() => {
    if (!participant || payload?.session.phase !== "ended") {
      return;
    }

    let active = true;

    const loadResult = async () => {
      try {
        const response = await fetch(`/api/session/result?participantId=${participant.id}`, {
          cache: "no-store"
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudo cargar tu resultado.");
        }

        if (active) {
          setResultSummary(data.result);
        }
      } catch (resultError) {
        if (active && resultError instanceof Error) {
          setError(resultError.message);
        }
      }
    };

    loadResult();

    return () => {
      active = false;
    };
  }, [participant, payload?.session.phase]);

  async function joinRoom() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/session/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "No se pudo registrar tu nombre.");
        return;
      }

      window.localStorage.setItem(participantStorageKey, JSON.stringify(data.participant));
      setParticipant(data.participant);
    } finally {
      setSaving(false);
    }
  }

  async function sendAnswer(optionId: string) {
    if (!participant) {
      return;
    }

    setSelectedOption(optionId);
    setError("");

    const response = await fetch("/api/session/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        participantId: participant.id,
        optionId
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "No se pudo enviar tu respuesta." }));
      setError(data.error ?? "No se pudo enviar tu respuesta.");
    }
  }

  if (!participant) {
    return (
      <div className="lobby-card">
        <span className="eyebrow">Acceso de participantes</span>
        <h1>Entra al escenario JAC</h1>
        <p className="muted">
          Escribe tu nombre para que tus respuestas aparezcan en el tablero en vivo.
        </p>

        <div className="stack-row">
          <input
            className="input"
            placeholder="Tu nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button className="button" disabled={saving} onClick={joinRoom}>
            {saving ? "Entrando..." : "Entrar a la dinamica"}
          </button>
        </div>

        {error ? <p className="footer-note">{error}</p> : null}
      </div>
    );
  }

  if (payload?.session.phase === "ended") {
    return (
      <div className="question-card">
        <span className="eyebrow">Cierre de actividad</span>
        <h1 className="question-title">Gracias por participar, {participant.name}</h1>
        <p className="muted">
          El presentador ya cerró la dinámica. Aquí tienes tu resultado personal y el repaso de tus respuestas.
        </p>

        <div className="metrics-grid" style={{ marginTop: 18 }}>
          <article className="metric">
            <strong>{resultSummary?.correctAnswers ?? 0}</strong>
            <span>respuestas correctas</span>
          </article>
          <article className="metric">
            <strong>{resultSummary?.answeredQuestions ?? 0}</strong>
            <span>preguntas respondidas</span>
          </article>
          <article className="metric">
            <strong>{resultSummary?.totalQuestions ?? questions.length}</strong>
            <span>preguntas totales</span>
          </article>
        </div>

        <div className="final-chart" style={{ marginTop: 24 }}>
          {resultSummary?.items.map((item, index) => (
            <div className="participant-result-card" key={item.questionId}>
              <div className="final-chart-label">
                <span className="final-chart-index">0{index + 1}</span>
                <div>
                  <strong>{item.prompt}</strong>
                  <p className="muted small">
                    Tu respuesta:{" "}
                    {item.selectedOptionLabel
                      ? `${item.selectedOptionEmoji ?? ""} ${item.selectedOptionLabel}`
                      : "Sin respuesta"}
                  </p>
                  <p className="muted small">
                    Respuesta correcta: {item.correctOptionEmoji} {item.correctOptionLabel}
                  </p>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className={`tag ${item.isCorrect ? "" : "danger"}`}>
                  {item.isCorrect ? "Correcta" : "Por reforzar"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="footer-note">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="question-card">
      {showConfetti ? (
        <div className="confetti-burst" aria-hidden="true">
          {Array.from({ length: 22 }).map((_, index) => (
            <span
              className="confetti-piece"
              key={`confetti-${index}`}
              style={
                {
                  ["--x" as string]: `${(index % 6) * 18 - 45}vw`,
                  ["--delay" as string]: `${(index % 5) * 0.08}s`,
                  ["--duration" as string]: `${2.6 + (index % 4) * 0.24}s`
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <span className="eyebrow">Hola, {participant.name}</span>
      <div className="session-sync-banner">
        <span className="tag">Sincronizado con el escenario</span>
        <span className="muted small">
          Cuando alguien avance el pulso central, esta pantalla cambiará para toda la audiencia.
        </span>
      </div>
      <h1 className="question-title">{currentQuestion.prompt}</h1>
      <p className="muted">
        Elige la opcion que mejor represente tu respuesta. Las tarjetas usan emociones y energia
        visual para que la experiencia se sienta mas viva y menos escolar.
      </p>

      <div className="option-grid" style={{ marginTop: 18 }}>
        {currentQuestion.options.map((option) => {
          const isActive = selectedOption === option.id;
          const isStar =
            payload?.session.phase === "reveal" && option.id === currentQuestion.correctOptionId;

          return (
            <button
              className={`option-card ${isActive ? "active" : ""}`}
              key={option.id}
              onClick={() => sendAnswer(option.id)}
            >
              <span className="emoji">{option.emoji}</span>
              <strong className="option-label">{option.label}</strong>
              <p className="muted small">{option.mood}</p>
              {isStar ? <span className="tag">Respuesta estrella</span> : null}
            </button>
          );
        })}
      </div>

      {payload?.session.phase === "reveal" ? (
        <p className="footer-note">
          {selectedOption === currentQuestion.correctOptionId
            ? "Acertaste. Activa el momento wow con confeti y espera a que el presentador abra el siguiente pulso."
            : "La respuesta correcta ya fue revelada. Mantén esta pantalla abierta y el presentador te moverá al siguiente pulso."}
        </p>
      ) : (
        <p className="footer-note">Tu seleccion se guarda y puede actualizarse hasta que reveles.</p>
      )}

      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
