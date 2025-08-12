import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ isAdmin: false });
    }

    // システム管理者チェック
    const { data: isAdmin } = await supabase
      .rpc('is_system_admin', { p_user_id: user.id });

    return NextResponse.json({ isAdmin: !!isAdmin });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false });
  }
}