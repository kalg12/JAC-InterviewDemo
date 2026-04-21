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

export type SessionPayload = {
  session: SessionState;
  participants: Participant[];
  stats: ResponseStat[];
};
