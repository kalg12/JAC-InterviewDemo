"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getShuffledOptions, questions } from "@/lib/questions";
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
  const [endedPayload, setEndedPayload] = useState<SessionPayload | null>(null);
  const [name, setName] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultSummary, setResultSummary] = useState<ParticipantResultSummary | null>(null);
  const [loadingResultSummary, setLoadingResultSummary] = useState(false);
  const isPollingRef = useRef(false);

  const currentQuestion = useMemo(() => {
    if (!payload) {
      return questions[0];
    }

    return questions[payload.session.currentQuestion] ?? questions[0];
  }, [payload]);
  const currentOptions = useMemo(() => getShuffledOptions(currentQuestion), [currentQuestion]);

  useEffect(() => {
    setParticipant(getStoredParticipant());
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (isPollingRef.current) {
        return;
      }

      isPollingRef.current = true;

      try {
        const participantId = getStoredParticipant()?.id;
        const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
        const response = await fetch(`/api/session${query}`, { cache: "no-store" });
        const data = await response.json();
        if (active) {
          setPayload(data);
          setError("");
        }
      } catch {
        if (active) {
          setError("No pudimos sincronizar la sesion.");
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
  }, []);

  useEffect(() => {
    setSelectedOption((currentSelected) => {
      const serverSelected = payload?.currentParticipantAnswerOptionId;
      const sourceOption = serverSelected ?? currentSelected;
      const currentOptionStillExists = currentQuestion.options.some((option) => option.id === sourceOption);

      return currentOptionStillExists ? sourceOption : "";
    });
    setShowConfetti(false);
  }, [currentQuestion.id, payload?.currentParticipantAnswerOptionId]);

  useEffect(() => {
    if (payload?.session.phase !== "ended") {
      setResultSummary(null);
      setLoadingResultSummary(false);
      setEndedPayload(null);
    }
  }, [payload?.session.phase]);

  useEffect(() => {
    if (payload?.session.phase === "ended") {
      setEndedPayload(payload);
    }
  }, [payload]);

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
    setLoadingResultSummary(true);

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
          setError("");
        }
      } catch (resultError) {
        if (active && resultError instanceof Error) {
          setError(resultError.message);
        }
      } finally {
        if (active) {
          setLoadingResultSummary(false);
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
      setSelectedOption("");
    } finally {
      setSaving(false);
    }
  }

  async function sendAnswer(optionId: string) {
    if (!participant || payload?.session.phase === "reveal" || payload?.session.phase === "ended") {
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

  if (!payload) {
    return (
      <div className="question-card">
        <span className="eyebrow">Sincronizando</span>
        <h1 className="question-title">Estamos preparando tu experiencia</h1>
        <p className="muted">
          Conectando tu pantalla con el pulso en vivo para mostrarte la pregunta correcta.
        </p>
      </div>
    );
  }

  if (payload.session.phase === "ended" || endedPayload) {
    const summary = resultSummary;

    return (
      <div className="question-card">
        <span className="eyebrow">Cierre de actividad</span>
        <h1 className="question-title">Gracias por participar, {participant.name}</h1>
        <p className="muted">
          La dinámica ya terminó y esta vista final quedará fija en tu pantalla para que puedas ver tu cierre sin que se reinicie la actividad.
        </p>

        <div className="metrics-grid" style={{ marginTop: 18 }}>
          <article className="metric">
            <strong>{loadingResultSummary ? "..." : summary?.correctAnswers ?? 0}</strong>
            <span>respuestas correctas</span>
          </article>
          <article className="metric">
            <strong>{loadingResultSummary ? "..." : summary?.incorrectAnswers ?? 0}</strong>
            <span>respuestas incorrectas</span>
          </article>
          <article className="metric">
            <strong>{loadingResultSummary ? "..." : summary?.unansweredQuestions ?? questions.length}</strong>
            <span>preguntas sin responder</span>
          </article>
          <article className="metric">
            <strong>{loadingResultSummary ? "..." : summary?.totalQuestions ?? questions.length}</strong>
            <span>preguntas totales</span>
          </article>
        </div>

        {loadingResultSummary ? (
          <div className="participant-summary-state">
            <span className="tag">Cerrando actividad</span>
            <p className="muted">
              Estamos dejando fija tu pantalla final para que veas tu resultado sin regresar a la pregunta inicial.
            </p>
          </div>
        ) : (
          <div className="participant-summary-state">
            <span className={`tag ${(summary?.correctAnswers ?? 0) === (summary?.totalQuestions ?? 0) ? "" : "danger"}`}>
              {(summary?.correctAnswers ?? 0) === (summary?.totalQuestions ?? 0)
                ? "Excelente cierre"
                : (summary?.unansweredQuestions ?? 0) > 0
                  ? "Te faltaron respuestas"
                  : "Resultado registrado"}
            </span>
            <p className="muted">
              Tu participación ya quedó guardada. Puedes dejar esta pantalla abierta; permanecerá en tu resultado final hasta que el presentador reinicie una nueva dinámica.
            </p>
          </div>
        )}

        {!loadingResultSummary && summary ? (
          <div className="final-results-list">
            {summary.items.map((item, index) => {
              const statusClassName = item.selectedOptionId
                ? item.isCorrect
                  ? "result-correct"
                  : "result-incorrect"
                : "result-unanswered";
              const statusLabel = item.selectedOptionId
                ? item.isCorrect
                  ? "Correcta"
                  : "Incorrecta"
                : "Sin responder";

              return (
                <article className={`participant-result-card ${statusClassName}`} key={item.questionId}>
                  <div className="participant-result-header">
                    <span className="question-pill">Pregunta {index + 1}</span>
                    <span className={`tag ${item.selectedOptionId && !item.isCorrect ? "danger" : ""}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <h3 className="participant-result-title">{item.prompt}</h3>
                  <p className="participant-result-line">
                    <strong>Tu respuesta:</strong>{" "}
                    {item.selectedOptionLabel
                      ? `${item.selectedOptionEmoji} ${item.selectedOptionLabel}`
                      : "No respondiste esta pregunta"}
                  </p>
                  <p className="participant-result-line">
                    <strong>Correcta:</strong> {item.correctOptionEmoji} {item.correctOptionLabel}
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}

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
      <div className="progress-banner">
        <span className="question-pill">
          Pregunta {(payload?.session.currentQuestion ?? 0) + 1} de {questions.length}
        </span>
        <span className="progress-caption">
          {payload.session.phase === "reveal" ? "Respuesta revelada" : "Pregunta activa"}
        </span>
      </div>
      <h1 className="question-title">{currentQuestion.prompt}</h1>
      <p className="muted">
        Elige la opcion que mejor represente tu respuesta. Las tarjetas usan emociones y energia
        visual para que la experiencia se sienta mas viva y menos escolar.
      </p>

      <div className="option-grid" style={{ marginTop: 18 }}>
        {currentOptions.map((option) => {
          const isActive = selectedOption === option.id;
          const isStar =
            payload.session.phase === "reveal" && option.id === currentQuestion.correctOptionId;
          const isRevealPhase = payload.session.phase === "reveal";
          const isIncorrectSelection =
            isRevealPhase && isActive && option.id !== currentQuestion.correctOptionId;
          const optionClasses = [
            "option-card",
            isActive ? "active" : "",
            isStar ? "correct-answer" : "",
            isIncorrectSelection ? "incorrect-answer" : "",
            isRevealPhase && !isStar && !isIncorrectSelection ? "reveal-muted" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={optionClasses}
              disabled={payload.session.phase === "reveal" || payload.session.phase === "ended"}
              key={option.id}
              onClick={() => sendAnswer(option.id)}
            >
              <span className="emoji">{option.emoji}</span>
              <strong className="option-label">{option.label}</strong>
              <p className="muted small">{option.mood}</p>
              <div className="option-tags">
                {isActive ? <span className="tag neutral-tag">Tu seleccion</span> : null}
                {isStar ? <span className="tag">Correcta</span> : null}
              </div>
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
