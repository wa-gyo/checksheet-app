-- =====================================================================
-- 01 事前確認（読み取りのみ・何も変更しません）
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行し、
-- 結果を必ず保存（スクリーンショット可）してから 02 を実行してください。
-- =====================================================================

-- (1) 対象テーブルと RLS の有効/無効
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('check_alcohol','check_fish_processing','check_kowari_processing',
                    'check_temp_hygiene','check_temp_closing','check_receiving',
                    'check_driving_report','daily_weather_logs')
order by 1;

-- (2) 既存のポリシー（02 で対象テーブルのポリシーは置き換えます）
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- (3) 主キー id の型（監査ログ用）
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and column_name = 'id'
order by 1;
