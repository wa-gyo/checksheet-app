-- =====================================================================
-- 02 セキュリティ強化（記録の改ざん防止・変更履歴・サーバー時刻・位置情報）
--
-- 実行前に必ず:
--   ・01_preflight_check.sql の結果を保存
--   ・Authentication → Users で管理者ユーザーを作成済み
--   ・下の「★管理者メールアドレス」を実際のアドレスに書き換え
--
-- 全体が1つのトランザクションです。途中でエラーになった場合は何も変更されません。
-- 何度実行しても同じ結果になります（再実行可）。
--
-- この SQL で変わること:
--   ・一般利用（ログインなし）: 閲覧と新規記録のみ可。修正・削除は不可
--       （運転日報の「帰着記録」だけは、未完了の運行に限り更新可）
--   ・管理者（app_admins に登録したユーザー）: 修正・削除が可能
--   ・修正・削除はすべて audit_log に変更前後の内容が残る（削除した記録も復元可能）
--   ・各記録に server_recorded_at（サーバーが受け付けた実際の時刻）を自動付与
--   ・check_alcohol に位置情報の列を追加
--   ・daily_weather_logs（天気の自動記録）は変更しません
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. 管理者テーブル
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;
drop policy if exists app_admins_self_read on public.app_admins;
create policy app_admins_self_read on public.app_admins
  for select to authenticated using (user_id = auth.uid());

-- ★管理者メールアドレス（Authentication → Users で作成したもの）に書き換えてください
insert into public.app_admins (user_id)
select id from auth.users where email = 'ここに管理者のメールアドレス'
on conflict do nothing;

-- 管理者が1人も登録されていなければ中止（管理画面から修正・削除できなくなるのを防ぐ）
do $$
begin
  if not exists (select 1 from public.app_admins) then
    raise exception '管理者が登録されていません。管理者ユーザーを作成し、上のメールアドレスを書き換えてから再実行してください。';
  end if;
end $$;

create or replace function public.is_app_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.app_admins where user_id = auth.uid()) $$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. 変更履歴（監査ログ）
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  table_name text not null,
  operation text not null,           -- UPDATE / DELETE
  row_id text,
  old_data jsonb,
  new_data jsonb,
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  changed_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select to authenticated using (public.is_app_admin());

create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  insert into public.audit_log (table_name, operation, row_id, old_data, new_data,
                                actor_user_id, actor_email, actor_role)
  values (
    tg_table_name,
    tg_op,
    (to_jsonb(old) ->> 'id'),
    to_jsonb(old),
    case when tg_op = 'UPDATE' then to_jsonb(new) else null end,
    auth.uid(),
    claims ->> 'email',
    coalesce(claims ->> 'role', current_user)
  );
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. サーバー受付時刻（端末の時計や手入力に左右されない記録時刻）
-- ---------------------------------------------------------------------
create or replace function public.set_server_recorded_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.server_recorded_at := now();
  else
    new.server_recorded_at := old.server_recorded_at;  -- 後から書き換えさせない
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. 各記録テーブルへの適用
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  p record;
  tables text[] := array['check_alcohol','check_fish_processing','check_kowari_processing',
                         'check_temp_hygiene','check_temp_closing','check_receiving',
                         'check_driving_report'];
begin
  foreach t in array tables loop
    -- サーバー受付時刻の列（既存の記録は空のまま、今後の記録から自動で入る）
    execute format('alter table public.%I add column if not exists server_recorded_at timestamptz', t);
    execute format('alter table public.%I alter column server_recorded_at set default now()', t);
    execute format('drop trigger if exists trg_server_recorded_at on public.%I', t);
    execute format('create trigger trg_server_recorded_at before insert or update on public.%I
                    for each row execute function public.set_server_recorded_at()', t);

    -- 変更履歴
    execute format('drop trigger if exists trg_audit_log on public.%I', t);
    execute format('create trigger trg_audit_log after update or delete on public.%I
                    for each row execute function public.write_audit_log()', t);

    -- 既存ポリシーをすべて削除してから作り直す
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);

    -- 権限（一般利用は閲覧・追加のみ）
    execute format('revoke update, delete, truncate on public.%I from anon', t);
    execute format('grant select, insert on public.%I to anon, authenticated', t);
    execute format('grant update, delete on public.%I to authenticated', t);

    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || '_read', t);
    execute format('create policy %I on public.%I for insert to anon, authenticated with check (true)',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin())',
                   t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_app_admin())',
                   t || '_admin_delete', t);
  end loop;
end $$;

-- 運転日報: 帰着時の記録（未完了の運行のみ・帰着関連の列のみ）は一般利用でも更新可
grant update (end_at, end_meter, refuel_liters, notes) on public.check_driving_report to anon, authenticated;
create policy check_driving_report_finish on public.check_driving_report
  for update to anon, authenticated
  using (end_meter is null)
  with check (true);

-- ---------------------------------------------------------------------
-- 5. 勤怠（基本チェック）の位置情報
-- ---------------------------------------------------------------------
alter table public.check_alcohol add column if not exists geo_status text;      -- inside / outside / unavailable
alter table public.check_alcohol add column if not exists geo_lat double precision;
alter table public.check_alcohol add column if not exists geo_lng double precision;
alter table public.check_alcohol add column if not exists geo_accuracy_m integer;
alter table public.check_alcohol add column if not exists geo_distance_m integer;

commit;

-- API が新しい列をすぐ認識するように
notify pgrst, 'reload schema';
