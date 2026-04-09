-- ============================================
-- Chat History — archief van alle chat interacties
-- ============================================

create table chat_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  response text not null,
  filters jsonb,
  created_at timestamptz not null default now()
);

create index idx_chat_history_user on chat_history(user_id);
create index idx_chat_history_created on chat_history(user_id, created_at desc);

-- RLS: users zien alleen hun eigen geschiedenis
alter table chat_history enable row level security;

create policy "Users can read own chat history"
  on chat_history for select
  using (user_id = auth.uid());

create policy "Users can insert own chat history"
  on chat_history for insert
  with check (user_id = auth.uid());

-- Admins kunnen alle geschiedenis lezen
create policy "Admins can read all chat history"
  on chat_history for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
