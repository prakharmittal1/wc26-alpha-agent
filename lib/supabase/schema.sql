-- WC26 Alpha Agent: knowledge store for the RAG layer.
--
-- Apply this in the Supabase SQL editor (or via `psql` against the project)
-- BEFORE running scripts/ingest.ts. Safe to re-run.

create extension if not exists vector;

create table if not exists public.playbook_docs (
  id          bigserial primary key,
  -- Stable per-row identity for idempotent re-ingest. The ingest script
  -- computes a sha256 of (source, primary key columns). Promoted to a real
  -- column (not just metadata) so PostgREST upsert(onConflict) can target it.
  doc_key     text        not null,
  content     text        not null,
  embedding   vector(768) not null,
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint playbook_docs_doc_key_unique unique (doc_key)
);

-- ANN index for cosine similarity search.
-- IVFFlat is a good default for tens-of-thousands of rows; revisit if
-- you ingest millions (HNSW is usually better at scale).
create index if not exists playbook_docs_embedding_idx
  on public.playbook_docs
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists playbook_docs_metadata_idx
  on public.playbook_docs using gin (metadata);

-- RPC for the Step 2 `query_historical_data` tool.
-- `filter` lets the agent narrow to e.g. {"source": "international_results", "home": "Mexico"}.
create or replace function public.match_playbook_docs(
  query_embedding vector(768),
  match_count     int   default 10,
  filter          jsonb default '{}'::jsonb
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    pd.id,
    pd.content,
    pd.metadata,
    1 - (pd.embedding <=> query_embedding) as similarity
  from public.playbook_docs pd
  where pd.metadata @> filter
  order by pd.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================================
-- Phase 2: Reddit sentiment pipeline.
-- ============================================================================

-- Raw classified posts (one row per Reddit post seen).
create table if not exists public.sentiment_posts (
  id          text        primary key,           -- reddit t3_id
  subreddit   text        not null,
  title       text        not null,
  url         text,
  posted_at   timestamptz not null,
  polarity    text        not null
              check (polarity in ('positive', 'negative', 'neutral')),
  teams       text[]      not null default '{}',
  raw         jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists sentiment_posts_posted_at_idx
  on public.sentiment_posts (posted_at desc);

create index if not exists sentiment_posts_teams_gin_idx
  on public.sentiment_posts using gin (teams);

-- Per-(team, date) rollup. `score` implements the spec's smoothed formula:
--   Sent_d = (N_pos - N_neg) / (N_pos + N_neutral + N_neg + 3)
create table if not exists public.sentiment_scores (
  team        text not null,
  date        date not null,
  n_pos       int  not null default 0,
  n_neg       int  not null default 0,
  n_neutral   int  not null default 0,
  score       numeric generated always as (
                (n_pos - n_neg)::numeric
                / (n_pos + n_neutral + n_neg + 3)
              ) stored,
  updated_at  timestamptz not null default now(),
  primary key (team, date)
);

create index if not exists sentiment_scores_date_idx
  on public.sentiment_scores (date desc);

-- Re-aggregates sentiment_posts into sentiment_scores.
-- Both filters are optional: pass null to refresh everything.
--
-- We delete-then-insert the affected (team, date) slice so a team that
-- *no longer* has posts on a date is removed rather than left stale.
create or replace function public.refresh_sentiment_scores(
  team_filter text[] default null,
  date_filter date   default null
) returns void
language plpgsql
as $$
begin
  -- Drop the slice we're about to rewrite.
  delete from public.sentiment_scores ss
  where (team_filter is null or ss.team = any(team_filter))
    and (date_filter is null or ss.date = date_filter);

  -- Re-aggregate from the raw posts table.
  insert into public.sentiment_scores (team, date, n_pos, n_neg, n_neutral, updated_at)
  select
    t                                                        as team,
    (posted_at at time zone 'UTC')::date                     as date,
    count(*) filter (where polarity = 'positive')::int       as n_pos,
    count(*) filter (where polarity = 'negative')::int       as n_neg,
    count(*) filter (where polarity = 'neutral')::int        as n_neutral,
    now()
  from public.sentiment_posts sp,
       unnest(sp.teams) as t
  where (team_filter is null or t = any(team_filter))
    and (date_filter is null
         or (sp.posted_at at time zone 'UTC')::date = date_filter)
  group by t, (posted_at at time zone 'UTC')::date;
end;
$$;
