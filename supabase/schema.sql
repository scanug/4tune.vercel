-- =============================================
-- 4Tune Platform - Supabase Schema
-- =============================================

-- Profili utente (creati automaticamente al signup)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'Player',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Stanze di gioco
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  game_type text not null default 'gts',
  host_id uuid references profiles(id) on delete set null,
  status text not null default 'waiting',
  round_index integer not null default 0,
  max_rounds integer not null default 5,
  round_ms integer not null default 15000,
  prep_ms integer not null default 3000,
  start_at bigint,
  playlist jsonb,
  current_round jsonb,
  scoreboard jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Giocatori nelle stanze
create table room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  avatar_url text,
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- Risposte ai round
create table answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_number integer not null,
  user_id uuid references profiles(id) on delete cascade,
  choice integer not null,
  answered_at bigint not null,
  unique(room_id, round_number, user_id)
);

-- Indici
create index idx_rooms_code on rooms(code);
create index idx_room_players_room on room_players(room_id);
create index idx_answers_room_round on answers(room_id, round_number);

-- =============================================
-- Realtime
-- =============================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table answers;
alter publication supabase_realtime add table profiles;

-- =============================================
-- RLS (Row Level Security)
-- =============================================
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table answers enable row level security;

-- Profiles
create policy "Chiunque può vedere i profili" on profiles for select using (true);
create policy "Utente può aggiornare il proprio profilo" on profiles for update using (auth.uid() = id);
create policy "Utente può inserire il proprio profilo" on profiles for insert with check (auth.uid() = id);

-- Rooms
create policy "Chiunque può vedere le stanze" on rooms for select using (true);
create policy "Utenti autenticati possono creare stanze" on rooms for insert with check (auth.uid() is not null);
create policy "Chiunque autenticato può aggiornare stanze" on rooms for update using (auth.uid() is not null);

-- Room players
create policy "Chiunque può vedere i giocatori" on room_players for select using (true);
create policy "Utenti autenticati possono unirsi" on room_players for insert with check (auth.uid() is not null);
create policy "Giocatore aggiorna proprio record" on room_players for update using (auth.uid() = user_id);

-- Answers
create policy "Chiunque può vedere le risposte" on answers for select using (true);
create policy "Utente può inserire propria risposta" on answers for insert with check (auth.uid() = user_id);

-- =============================================
-- Funzioni RPC
-- =============================================

-- Crea automaticamente il profilo al signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Player')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Timestamp server in ms
create or replace function server_now()
returns bigint as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$ language sql;
