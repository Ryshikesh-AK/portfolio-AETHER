-- Supabase Schema Migration for Ashi / AETHER Portfolio

-- 1. Enable UUID extension if needed
create extension if not exists "uuid-ossp";

-- 2. Categories table
create table if not exists public.categories (
  slug text primary key,
  label text not null,
  sort_order integer not null default 0
);

-- 3. Projects table
create table if not exists public.projects (
  id text primary key,
  slug text not null unique,
  title text not null,
  meta text,
  subtitle text,
  categories jsonb not null default '[]'::jsonb,
  year text,
  deliverables text,
  tech text,
  description text,
  image text,
  thumb text,
  featured boolean not null default false,
  hero_slot integer unique,
  hero_title text,
  hero_tag text,
  badges jsonb not null default '[]'::jsonb,
  alt text,
  sort_order integer not null default 0,
  show_photo boolean not null default true,
  show_video boolean not null default true,
  show_graphic boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Site configuration table (key/value)
create table if not exists public.site (
  key text primary key,
  value jsonb not null
);

-- 5. Row Level Security (RLS)
alter table public.categories enable row level security;
alter table public.projects enable row level security;
alter table public.site enable row level security;

-- Allow public read access to all users
create policy "Allow public read categories" on public.categories for select using (true);
create policy "Allow public read projects" on public.projects for select using (true);
create policy "Allow public read site" on public.site for select using (true);

-- Allow authenticated users (admin) full CRUD access
create policy "Allow authenticated write categories" on public.categories for all using (auth.role() = 'authenticated');
create policy "Allow authenticated write projects" on public.projects for all using (auth.role() = 'authenticated');
create policy "Allow authenticated write site" on public.site for all using (auth.role() = 'authenticated');

-- 6. Storage Bucket setup
-- Note: You can also create the bucket 'portfolio-media' via the Supabase Dashboard:
-- Storage -> New Bucket -> Name: 'portfolio-media', Public: true
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do nothing;

create policy "Public Access to portfolio-media"
on storage.objects for select
using (bucket_id = 'portfolio-media');

create policy "Authenticated Users can upload to portfolio-media"
on storage.objects for insert
with check (bucket_id = 'portfolio-media' and auth.role() = 'authenticated');

create policy "Authenticated Users can update portfolio-media"
on storage.objects for update
using (bucket_id = 'portfolio-media' and auth.role() = 'authenticated');

create policy "Authenticated Users can delete portfolio-media"
on storage.objects for delete
using (bucket_id = 'portfolio-media' and auth.role() = 'authenticated');
