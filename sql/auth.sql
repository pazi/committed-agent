-- ============================================
-- Authentication & Authorization Schema
-- Werkt samen met Supabase Auth (auth.users)
-- ============================================

-- User profiles gekoppeld aan Supabase Auth users
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'client', -- 'admin', 'manager', 'client'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint valid_role check (role in ('admin', 'manager', 'client'))
);

create index idx_profiles_tenant on user_profiles(tenant_id);
create index idx_profiles_email on user_profiles(email);

-- RLS op user_profiles
alter table user_profiles enable row level security;

-- Users kunnen hun eigen profiel lezen
create policy "Users can read own profile"
  on user_profiles for select
  using (id = auth.uid());

-- Admins kunnen alle profiles van hun tenant lezen
create policy "Admins can read tenant profiles"
  on user_profiles for select
  using (
    tenant_id in (
      select tenant_id from user_profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Admins kunnen profiles in hun tenant aanmaken/updaten
create policy "Admins can manage tenant profiles"
  on user_profiles for all
  using (
    tenant_id in (
      select tenant_id from user_profiles where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- RLS policies voor data tabellen (tenant isolatie)
-- Users zien alleen data van hun eigen tenant
-- ============================================

create policy "Tenant isolation accounts"
  on accounts for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation campaigns"
  on campaigns for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation adsets"
  on adsets for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation ads"
  on ads for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation creatives"
  on creatives for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation audiences"
  on audiences for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation ad_insights"
  on ad_insights for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation benchmarks"
  on benchmarks for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation automation_rules"
  on automation_rules for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

create policy "Tenant isolation automation_logs"
  on automation_logs for select
  using (tenant_id in (select tenant_id from user_profiles where id = auth.uid()));

-- Managers en admins mogen automation rules beheren
create policy "Managers can manage rules"
  on automation_rules for all
  using (
    tenant_id in (
      select tenant_id from user_profiles
      where id = auth.uid() and role in ('admin', 'manager')
    )
  );

-- ============================================
-- Trigger: maak automatisch een user_profile aan bij registratie
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, tenant_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    (new.raw_user_meta_data->>'tenant_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'client')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
