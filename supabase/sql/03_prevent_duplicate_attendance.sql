-- =====================================================================
-- 03 勤怠（基本チェック）の二重送信をデータベース側でも防止する
--
-- アプリ側でも二重送信を防いでいますが、通信の再送や2台の端末からの
-- 同時送信など、アプリだけでは防ぎきれない場合のための最終防衛です。
--
-- 同じ人の同じ区分（出勤時・退勤時）の記録で、次のどちらかに当てはまる場合は受け付けません。
--   ・記録日時がまったく同じ
--   ・2分以内に送信されたもの
-- （通常の利用で2分以内に同じ区分を2回送ることはありません）
--
-- 02_security_hardening.sql の実行後に実行してください（server_recorded_at 列を使います）。
-- 何度実行しても同じ結果になります。
-- 取り消す場合: drop trigger if exists trg_prevent_duplicate_attendance on public.check_alcohol;
-- =====================================================================

begin;

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

  -- 同じ人の送信を1件ずつ順番に処理する（同時送信でもすり抜けない）
  perform pg_advisory_xact_lock(hashtext('check_alcohol:' || norm));

  if exists (
    select 1
    from public.check_alcohol c
    where regexp_replace(coalesce(c.staff_name, ''), '[[:space:]　]+', '', 'g') = norm
      and c.notes like kind || '%'
      and (c.checked_at = new.checked_at or c.server_recorded_at > now() - interval '2 minutes')
  ) then
    raise exception '%の記録はすでに送信されています（二重送信を防止しました）', kind
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists trg_prevent_duplicate_attendance on public.check_alcohol;
create trigger trg_prevent_duplicate_attendance
  before insert on public.check_alcohol
  for each row execute function public.prevent_duplicate_attendance();

commit;
