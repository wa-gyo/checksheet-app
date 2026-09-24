import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 末尾のスラッシュや余計な空白を自動除去
const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
const cleanKey = supabaseAnonKey.trim();

export const supabase = createClient(cleanUrl, cleanKey);