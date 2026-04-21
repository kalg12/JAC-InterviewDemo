export type SessionPhase = "lobby" | "question" | "reveal" | "ended";

export type SessionState = {
  code: string;
  title: string;
  currentQuestion: number;
  phase: SessionPhase;
};

export type Participant = {
  id: string;
  name: string;
};

export type ResponseStat = {
  optionId: string;
  count: number;
};

export type FinalQuestionSummary = {
  questionId: string;
  prompt: string;
  correctOptionId: string;
  totalResponses: number;
  correctResponses: number;
};

export type ParticipantQuestionResult = {
  questionId: string;
  prompt: string;
  selectedOptionId: string | null;
  selectedOptionLabel: string | null;
  selectedOptionEmoji: string | null;
  correctOptionId: string;
  correctOptionLabel: string;
  correctOptionEmoji: string;
  isCorrect: boolean;
};

export type ParticipantResultSummary = {
  participantId: string;
  participantName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  items: ParticipantQuestionResult[];
};

export type SessionPayload = {
  session: SessionState;
  participants: Participant[];
  stats: ResponseStat[];
  finalSummary: FinalQuestionSummary[];
  currentParticipantAnswerOptionId?: string | null;
};

export type SessionControlPayload = {
  session: SessionState;
  payload: SessionPayload;
};
