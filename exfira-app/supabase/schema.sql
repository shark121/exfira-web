create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  password_hash text not null,
  created_at  timestamptz default now()
);
