-- =============================================
-- Phase 3: Stripe subscriptions + GED tables
-- =============================================

-- Subscriptions table (linked to auth.users)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan text not null check (plan in ('essentiel', 'pro', 'cabinet')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Documents table (GED)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  client_ref text,
  name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  category text not null default 'autre' check (category in ('cni', 'kbis', 'rib', 'contrat', 'facture', 'attestation', 'autre')),
  expiration_date date,
  current_version int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.documents enable row level security;

create policy "Users can manage own documents"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Document versions table
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade not null,
  version_number int not null,
  file_path text not null,
  file_size bigint,
  uploaded_by uuid references auth.users(id),
  comment text,
  created_at timestamptz default now(),
  unique(document_id, version_number)
);

alter table public.document_versions enable row level security;

create policy "Users can view own document versions"
  on public.document_versions for all
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
      and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_versions.document_id
      and d.user_id = auth.uid()
    )
  );

-- Storage bucket for GED documents
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
