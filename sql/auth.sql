-- ============================================
-- Authentication & Authorization Schema
-- Werkt samen met Supabase Auth (auth.users)
-- ============================================

-- User profiles gekoppeld aan Supabase Auth users
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'client', -- 'admin', 'manager', 'client'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_role check (role in ('admin', 'manager', 'client'))
);

create index idx_profiles_email on user_profiles(email);

-- Junction table: users <-> tenants (many-to-many)
create table user_tenants (
  user_id uuid not null references user_profiles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create index idx_user_tenants_user on user_tenants(user_id);
create index idx_user_tenants_tenant on user_tenants(tenant_id);

-- RLS op user_profiles
alter table user_profiles enable row level security;
alter table user_tenants enable row level security;

-- Users kunnen hun eigen profiel lezen
create policy "Users can read own profile"
  on user_profiles for select
  using (id = auth.uid());

-- Admins kunnen alle profiles lezen
create policy "Admins can read all profiles"
  on user_profiles for select
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- Admins kunnen profiles aanmaken/updaten
create policy "Admins can manage profiles"
  on user_profiles for all
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- User tenants: users zien hun eigen koppelingen
create policy "Users can read own tenants"
  on user_tenants for select
  using (user_id = auth.uid());

-- Admins beheren alle tenant koppelingen
create policy "Admins can manage user tenants"
  on user_tenants for all
  using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================
-- RLS policies voor data tabellen (tenant isolatie)
-- Users zien alleen data van hun gekoppelde tenants
-- ============================================

create policy "Tenant isolation accounts"
  on accounts for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation campaigns"
  on campaigns for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation adsets"
  on adsets for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation ads"
  on ads for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation creatives"
  on creatives for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation audiences"
  on audiences for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation ad_insights"
  on ad_insights for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation benchmarks"
  on benchmarks for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation automation_rules"
  on automation_rules for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

create policy "Tenant isolation automation_logs"
  on automation_logs for select
  using (tenant_id in (select tenant_id from user_tenants where user_id = auth.uid()));

-- Managers en admins mogen automation rules beheren
create policy "Managers can manage rules"
  on automation_rules for all
  using (
    tenant_id in (
      select tenant_id from user_tenants
      where user_id = auth.uid()
    )
    and exists (
      select 1 from user_profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ============================================
-- Trigger: maak automatisch user_profile + tenant koppelingen aan
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Maak profiel aan
  insert into public.user_profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );

  -- Admins en managers: koppel aan ALLE tenants
  if coalesce(new.raw_user_meta_data->>'role', 'client') in ('admin', 'manager') then
    insert into public.user_tenants (user_id, tenant_id)
    select new.id, id from public.tenants;
  -- Clients: koppel aan de meegegeven tenant
  elsif new.raw_user_meta_data->>'tenant_id' is not null then
    insert into public.user_tenants (user_id, tenant_id)
    values (new.id, (new.raw_user_meta_data->>'tenant_id')::uuid);
  end if;

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
