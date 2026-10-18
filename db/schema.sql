-- Datacare Care — Neon PostgreSQL schema
-- Safe to run repeatedly (npm run db:migrate).

-- gen_random_uuid() is built into PostgreSQL 13+ (Neon runs 16/17), so no extension is needed.

-- Registered accounts.
create table if not exists users (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text,
  email              text unique,
  phone              text unique,
  password_hash      text not null,
  preferred_language text not null default 'en',
  created_at         timestamptz not null default now(),
  last_login_at      timestamptz,
  constraint users_identifier check (email is not null or phone is not null)
);

-- Every browser that opens the app, signed in or not (one row per anonymous visitor cookie).
create table if not exists visitors (
  id          uuid primary key,
  user_id     uuid references users(id) on delete set null,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  visit_count integer not null default 1,
  language    text,
  user_agent  text,
  referrer    text
);
create index if not exists visitors_user_idx on visitors(user_id);

-- Each time a location is obtained: GPS/browser, manual address, saved, or live tracking.
-- Coordinates are rounded to ~100 m before storage.
create table if not exists location_detections (
  id          bigserial primary key,
  visitor_id  uuid not null references visitors(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  method      text not null check (method in ('gps', 'manual', 'saved', 'tracking')),
  lat         numeric(8,3),
  lng         numeric(8,3),
  accuracy_m  integer,
  label       text,
  state       text,
  lga         text,
  query       text,
  success     boolean not null default true,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists location_detections_created_idx on location_detections(created_at);

-- Facilities seen in search results (from the GRID3/NHFR registry and OpenStreetMap), kept as an offline fallback.
create table if not exists facilities (
  id          text primary key,           -- e.g. grid3:<nhfr uid> or osm:node/123
  name        text not null,
  category    text not null,
  lat         double precision not null,
  lng         double precision not null,
  phone       text,
  address     text,
  opening_hours text,
  tags        jsonb not null default '{}'::jsonb,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists facilities_geo_idx on facilities(lat, lng);
create index if not exists facilities_category_idx on facilities(category);

-- Every nearby-facility search.
create table if not exists facility_searches (
  id            uuid primary key default gen_random_uuid(),
  visitor_id    uuid not null references visitors(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  facility_type text not null,
  lat           numeric(8,3) not null,
  lng           numeric(8,3) not null,
  radius_m      integer not null,
  result_count  integer not null,
  source        text not null,            -- 'live' | 'cache' | 'none'
  language      text,
  duration_ms   integer,
  created_at    timestamptz not null default now()
);
create index if not exists facility_searches_created_idx on facility_searches(created_at);

-- Every time directions to a facility are shown.
create table if not exists direction_requests (
  id            bigserial primary key,
  visitor_id    uuid not null references visitors(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  search_id     uuid references facility_searches(id) on delete set null,
  facility_id   text references facilities(id) on delete set null,
  facility_name text,
  mode          text not null check (mode in ('driving', 'walking')),
  distance_m    integer,
  duration_s    integer,
  success       boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists direction_requests_created_idx on direction_requests(created_at);

-- Catch-all interaction log: page views, language changes, call taps, auth prompts, etc.
create table if not exists events (
  id          bigserial primary key,
  visitor_id  uuid not null references visitors(id) on delete cascade,
  user_id     uuid references users(id) on delete set null,
  name        text not null,
  path        text,
  language    text,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_name_created_idx on events(name, created_at);

-- Reporting views ------------------------------------------------------------

create or replace view v_impact_totals as
select
  (select count(*) from visitors)                                   as people_reached,
  (select count(*) from users)                                      as registered_users,
  (select count(*) from location_detections where success)          as locations_detected,
  (select count(*) from facility_searches)                          as facility_searches,
  (select count(*) from direction_requests where success)           as directions_shown,
  (select count(*) from facilities)                                 as facilities_indexed,
  (select count(*) from events where name = 'call_facility')        as facility_calls;

create or replace view v_daily_usage as
select d::date as day,
  (select count(distinct visitor_id) from events e where e.created_at::date = d::date)              as active_visitors,
  (select count(*) from location_detections l where l.created_at::date = d::date and l.success)    as locations_detected,
  (select count(*) from facility_searches s where s.created_at::date = d::date)                    as searches,
  (select count(*) from direction_requests r where r.created_at::date = d::date and r.success)     as directions_shown
from generate_series(now() - interval '89 days', now(), interval '1 day') d;

create or replace view v_searches_by_type as
select facility_type, count(*) as searches, round(avg(result_count), 1) as avg_results,
       count(*) filter (where result_count = 0) as zero_result_searches
from facility_searches group by facility_type;

create or replace view v_language_usage as
select coalesce(language, 'en') as language, count(*) as visitors
from visitors group by 1;
