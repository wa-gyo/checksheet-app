-- =====================================================================
-- 04 管理者による勤怠の補正入力（出勤・退勤とも記録を忘れた場合など）
--
-- ・補正の記録はアルコールチェック「未実施」として残すため、測定値を空にできるようにします
-- ・補正の記録には「管理者補正」の印・理由・補正した管理者を自動で残します
-- ・管理者以外（ログインなしのスタッフ画面など）は補正の記録を作れません
--
-- 02_security_hardening.sql の実行後に実行してください（is_app_admin() を使います）。
-- 何度実行しても同じ結果になります。既存の記録は変更しません。
-- =====================================================================

begin;

-- 測定値を空にできるようにする（補正の記録はアルコールチェック未実施のため）
alter table public.check_alcohol alter column alcohol_value drop not null;

alter table public.check_alcohol add column if not exists is_admin_correction boolean not null default false;
alter table public.check_alcohol add column if not exists correction_reason text;
alter table public.check_alcohol add column if not exists corrected_by uuid;
alter table public.check_alcohol add column if not exists corrected_by_email text;

-- 補正した管理者を自動で記録（画面から送られた値は使わない）
create or replace function public.set_correction_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if tg_op = 'UPDATE' then
    new.is_admin_correction := old.is_admin_correction;
    new.corrected_by := old.corrected_by;
    new.corrected_by_email := old.corrected_by_email;
    return new;
  end if;

  if new.is_admin_correction then
    new.corrected_by := auth.uid();
    new.corrected_by_email := claims ->> 'email';
  else
    new.corrected_by := null;
    new.corrected_by_email := null;
    new.correction_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_set_correction_actor on public.check_alcohol;
create trigger trg_set_correction_actor
  before insert or update on public.check_alcohol
  for each row execute function public.set_correction_actor();

-- 補正の記録は管理者だけが作れる（既存の「追加可」ルールに上乗せする制限）
drop policy if exists check_alcohol_correction_admin_only on public.check_alcohol;
create policy check_alcohol_correction_admin_only on public.check_alcohol
  as restrictive
  for insert to anon, authenticated
  with check (not is_admin_correction or public.is_app_admin());

-- 03（二重送信防止）を適用済みの場合: 管理者補正は「2分以内」の制限から除外する
-- （複数日分を続けて補正できるように。記録日時がまったく同じものは引き続き拒否）
create or replace function public.prevent_duplicate_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  norm text;
begin
  kind := case
    when new.notes like '出勤時%' then '出勤時'
    when new.notes like '退勤時%' then '退勤時'
    else null
  end;
  if kind is null then
    return new;
  end if;

  norm := regexp_replace(coalesce(new.staff_name, ''), '[[:space:]　]+', '', 'g');
  perform pg_advisory_xact_lock(hashtext('check_alcohol:' || norm));

  if exists (
    select 1
    from public.check_alcohol c
    where regexp_replace(coalesce(c.staff_name, ''), '[[:space:]　]+', '', 'g') = norm
      and c.notes like kind || '%'
      and (
        c.checked_at = new.checked_at
        or (not coalesce(new.is_admin_correction, false) and c.server_recorded_at > now() - interval '2 minutes')
      )
  ) then
    raise exception '%の記録はすでに送信されています（二重送信を防止しました）', kind
      using errcode = 'P0001';
  end if;

  return new;
end $$;

commit;

notify pgrst, 'reload schema';
