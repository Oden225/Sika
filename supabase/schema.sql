-- Sika : une ligne par utilisateur, contenant toutes ses données (JSON).
-- À exécuter une fois dans Supabase : SQL Editor → New query → Run.

create table if not exists public.sika_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.sika_state enable row level security;

-- Chaque utilisateur ne peut lire et écrire que sa propre ligne.
drop policy if exists "sika_select_own" on public.sika_state;
drop policy if exists "sika_insert_own" on public.sika_state;
drop policy if exists "sika_update_own" on public.sika_state;
drop policy if exists "sika_delete_own" on public.sika_state;

create policy "sika_select_own" on public.sika_state for select using (auth.uid() = user_id);
create policy "sika_insert_own" on public.sika_state for insert with check (auth.uid() = user_id);
create policy "sika_update_own" on public.sika_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sika_delete_own" on public.sika_state for delete using (auth.uid() = user_id);

-- Droits d'accès via l'API (nécessaires sur les projets récents, où les
-- nouvelles tables ne sont plus exposées automatiquement).
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.sika_state to authenticated;

-- Prise en compte immédiate de la table par l'API.
notify pgrst, 'reload schema';
