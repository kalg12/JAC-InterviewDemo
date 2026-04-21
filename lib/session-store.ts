import { joinCode, questions, sessionTitle } from "@/lib/questions";
import type {
  FinalQuestionSummary,
  Participant,
  ParticipantResultSummary,
  ResponseStat,
  SessionPayload,
  SessionState
} from "@/lib/types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AnswerRow = {
  participant_id: string;
  question_id: string;
  option_id: string;
};

type MemoryState = {
  session: SessionState;
  participants: Participant[];
  answers: AnswerRow[];
};

const defaultSession: SessionState = {
  code: joinCode,
  title: sessionTitle,
  currentQuestion: 0,
  phase: "lobby"
};

declare global {
  var __quizJacMemoryState__: MemoryState | undefined;
}

const memoryState: MemoryState =
  globalThis.__quizJacMemoryState__ ??
  {
    session: { ...defaultSession },
    participants: [] as Participant[],
    answers: [] as AnswerRow[]
  };

globalThis.__quizJacMemoryState__ = memoryState;

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return null;
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false
    }
  });
}

async function ensureSupabaseSession(client: SupabaseClient) {
  const { data: existing } = await client
    .from("quiz_sessions")
    .select("*")
    .eq("code", joinCode)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from("quiz_sessions")
    .insert({
      code: joinCode,
      title: sessionTitle,
      current_question: 0,
      phase: "lobby"
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSessionPayload(): Promise<SessionPayload> {
  const client = getSupabaseAdmin();

  if (!client) {
    return {
      session: memoryState.session,
      participants: memoryState.participants,
      stats: getStatsForCurrentQuestion(memoryState.answers, memoryState.session.currentQuestion),
      finalSummary: getFinalSummary(memoryState.answers)
    };
  }

  const session = await ensureSupabaseSession(client);

  const [{ data: participants }, { data: responses }] = await Promise.all([
    client.from("quiz_participants").select("id, name").eq("session_code", joinCode).order("created_at"),
    client.from("quiz_responses").select("participant_id, question_id, option_id").eq("session_code", joinCode)
  ]);

  return {
    session: {
      code: session.code,
      title: session.title,
      currentQuestion: session.current_question,
      phase: session.phase
    },
    participants: participants ?? [],
    stats: getStatsForCurrentQuestion(responses ?? [], session.current_question),
    finalSummary: getFinalSummary(responses ?? [])
  };
}

export async function joinParticipant(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Escribe un nombre antes de entrar.");
  }

  const client = getSupabaseAdmin();

  if (!client) {
    const participant: Participant = {
      id: crypto.randomUUID(),
      name: trimmed
    };
    memoryState.participants.push(participant);
    return participant;
  }

  await ensureSupabaseSession(client);

  const { data, error } = await client
    .from("quiz_participants")
    .insert({
      session_code: joinCode,
      name: trimmed
    })
    .select("id, name")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function submitAnswer(participantId: string, optionId: string) {
  const currentQuestion = questions[memoryState.session.currentQuestion];
  const questionId = currentQuestion.id;
  const client = getSupabaseAdmin();

  if (!client) {
    memoryState.answers = memoryState.answers.filter(
      (answer) => !(answer.participant_id === participantId && answer.question_id === questionId)
    );
    memoryState.answers.push({
      participant_id: participantId,
      question_id: questionId,
      option_id: optionId
    });
    return;
  }

  const session = await ensureSupabaseSession(client);
  const liveQuestionId = questions[session.current_question]?.id ?? questions[0].id;

  const { error } = await client.from("quiz_responses").upsert(
    {
      session_code: joinCode,
      participant_id: participantId,
      question_id: liveQuestionId,
      option_id: optionId
    },
    {
      onConflict: "session_code,participant_id,question_id"
    }
  );

  if (error) {
    throw error;
  }
}

export async function controlSession(action: "next" | "reveal" | "reset" | "end") {
  const client = getSupabaseAdmin();

  if (!client) {
    if (action === "next") {
      memoryState.session.currentQuestion =
        memoryState.session.phase === "lobby"
          ? 0
          : Math.min(memoryState.session.currentQuestion + 1, questions.length - 1);
      memoryState.session.phase = "question";
    }

    if (action === "reveal") {
      memoryState.session.phase = "reveal";
    }

    if (action === "reset") {
      memoryState.session = { ...defaultSession };
      memoryState.participants = [];
      memoryState.answers = [];
    }

    if (action === "end") {
      memoryState.session.phase = "ended";
    }

    return memoryState.session;
  }

  const session = await ensureSupabaseSession(client);
  const currentQuestion =
    action === "next"
      ? session.phase === "lobby"
        ? 0
        : Math.min(session.current_question + 1, questions.length - 1)
      : action === "reset"
        ? 0
        : session.current_question;
  const phase =
    action === "reveal"
      ? "reveal"
      : action === "reset"
        ? "lobby"
        : action === "end"
          ? "ended"
          : "question";

  if (action === "reset") {
    await client.from("quiz_responses").delete().eq("session_code", joinCode);
    await client.from("quiz_participants").delete().eq("session_code", joinCode);
  }

  const { data, error } = await client
    .from("quiz_sessions")
    .update({
      current_question: currentQuestion,
      phase
    })
    .eq("code", joinCode)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    code: data.code,
    title: data.title,
    currentQuestion: data.current_question,
    phase: data.phase
  } satisfies SessionState;
}

export async function getParticipantResultSummary(
  participantId: string
): Promise<ParticipantResultSummary> {
  const client = getSupabaseAdmin();

  if (!participantId) {
    throw new Error("Participante invalido.");
  }

  if (!client) {
    const participant = memoryState.participants.find((item) => item.id === participantId);

    if (!participant) {
      throw new Error("No encontramos ese participante.");
    }

    return buildParticipantResultSummary(participant, memoryState.answers);
  }

  await ensureSupabaseSession(client);

  const [{ data: participant, error: participantError }, { data: responses = [], error: responseError }] =
    await Promise.all([
      client
        .from("quiz_participants")
        .select("id, name")
        .eq("session_code", joinCode)
        .eq("id", participantId)
        .maybeSingle(),
      client
        .from("quiz_responses")
        .select("participant_id, question_id, option_id")
        .eq("session_code", joinCode)
        .eq("participant_id", participantId)
    ]);

  if (participantError || responseError) {
    throw participantError ?? responseError ?? new Error("No se pudieron leer los resultados.");
  }

  if (!participant) {
    throw new Error("No encontramos ese participante.");
  }

  return buildParticipantResultSummary(participant, responses ?? []);
}

function getStatsForCurrentQuestion(
  answers: AnswerRow[],
  currentQuestionIndex: number
): ResponseStat[] {
  const questionId = questions[currentQuestionIndex]?.id ?? questions[0].id;
  const filtered = answers.filter((answer) => answer.question_id === questionId);

  return questions[currentQuestionIndex]?.options.map((option) => ({
    optionId: option.id,
    count: filtered.filter((answer) => answer.option_id === option.id).length
  })) ?? [];
}

function getFinalSummary(answers: AnswerRow[]): FinalQuestionSummary[] {
  return questions.map((question) => {
    const responses = answers.filter((answer) => answer.question_id === question.id);
    const correctResponses = responses.filter(
      (answer) => answer.option_id === question.correctOptionId
    ).length;

    return {
      questionId: question.id,
      prompt: question.prompt,
      correctOptionId: question.correctOptionId,
      totalResponses: responses.length,
      correctResponses
    };
  });
}

function buildParticipantResultSummary(
  participant: Participant,
  answers: AnswerRow[]
): ParticipantResultSummary {
  const items = questions.map((question) => {
    const selected = answers.find((answer) => answer.question_id === question.id);
    const selectedOption = question.options.find((option) => option.id === selected?.option_id);
    const correctOption =
      question.options.find((option) => option.id === question.correctOptionId) ?? question.options[0];

    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedOptionId: selectedOption?.id ?? null,
      selectedOptionLabel: selectedOption?.label ?? null,
      selectedOptionEmoji: selectedOption?.emoji ?? null,
      correctOptionId: correctOption.id,
      correctOptionLabel: correctOption.label,
      correctOptionEmoji: correctOption.emoji,
      isCorrect: selectedOption?.id === correctOption.id
    };
  });

  return {
    participantId: participant.id,
    participantName: participant.name,
    totalQuestions: questions.length,
    answeredQuestions: items.filter((item) => item.selectedOptionId).length,
    correctAnswers: items.filter((item) => item.isCorrect).length,
    items
  };
}
