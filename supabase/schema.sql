create extension if not exists pgcrypto;

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resident_id text not null unique,
  chart_no text unique,
  created_at timestamptz not null default now()
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  height_cm numeric not null,
  weight_kg numeric not null,
  bmi numeric not null,
  age_months integer not null,
  created_at timestamptz not null default now()
);

create index if not exists visits_patient_id_created_at_idx on visits (patient_id, created_at desc);
