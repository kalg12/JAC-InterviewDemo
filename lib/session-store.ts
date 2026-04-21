import { joinCode, questions, sessionTitle } from "@/lib/questions";
import type {
  FinalQuestionSummary,
  Participant,
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

const defaultSession: SessionState = {
  code: joinCode,
  title: sessionTitle,
  currentQuestion: 0,
  phase: "lobby"
};

const memoryState = {
  session: { ...defaultSession },
  participants: [] as Participant[],
  answers: [] as AnswerRow[]
};

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

  const [{ data: participants = [] }, { data: responses = [] }] = await Promise.all([
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
    participants,
    stats: getStatsForCurrentQuestion(responses, session.current_question),
    finalSummary: getFinalSummary(responses)
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

export async function controlSession(action: "next" | "reveal" | "reset") {
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
    action === "reveal" ? "reveal" : action === "reset" ? "lobby" : "question";

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
