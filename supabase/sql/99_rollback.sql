-- =====================================================================
-- 99 緊急時の切り戻し
-- 02 適用後に記録の送信ができない等の問題が起きた場合に実行してください。
-- 対象テーブルの制限を外し、02 以前と同じく「誰でも閲覧・追加・修正・削除可」に戻します。
-- （追加した列・変更履歴・管理者テーブルはデータ保全のため残します）
-- =====================================================================
begin;
do $$
declare
  t text;
  p record;
  tables text[] := array['check_alcohol','check_fish_processing','check_kowari_processing',
                         'check_temp_hygiene','check_temp_closing','check_receiving',
                         'check_driving_report'];
begin
  foreach t in array tables loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;
commit;
notify pgrst, 'reload schema';
