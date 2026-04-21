"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { questions } from "@/lib/questions";
import type { Participant, SessionPayload } from "@/lib/types";

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
            ? "Acertaste. Activa el momento wow con confeti y prepárate para el siguiente pulso."
            : "La respuesta correcta ya fue revelada. Si quieres, puedes dejar esta pantalla abierta para seguir el siguiente pulso."}
        </p>
      ) : (
        <p className="footer-note">Tu seleccion se guarda y puede actualizarse hasta que reveles.</p>
      )}

      {error ? <p className="footer-note">{error}</p> : null}
    </div>
  );
}
