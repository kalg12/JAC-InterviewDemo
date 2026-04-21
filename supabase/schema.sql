create table if not exists quiz_sessions (
  code text primary key,
  title text not null,
  current_question int not null default 0,
  phase text not null default 'lobby',
  created_at timestamptz not null default now()
);

create table if not exists quiz_participants (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references quiz_sessions(code) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  session_code text not null references quiz_sessions(code) on delete cascade,
  participant_id uuid not null references quiz_participants(id) on delete cascade,
  question_id text not null,
  option_id text not null,
  created_at timestamptz not null default now(),
  unique (session_code, participant_id, question_id)
);
