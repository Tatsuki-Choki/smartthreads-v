import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// 繰り返しスケジュール一覧取得
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // 繰り返しスケジュール一覧を取得
    const { data: schedules, error } = await supabase
      .from('recurring_schedules')
      .select(`
        *,
        post_templates (
          id,
          name,
          content,
          media_type
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('スケジュール取得エラー:', error);
      return NextResponse.json(
        { error: 'スケジュールの取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schedules: schedules || [],
      total: schedules?.length || 0
    });

  } catch (error) {
    console.error('スケジュール取得エラー:', error);
    return NextResponse.json(
      { error: 'スケジュール取得中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 繰り返しスケジュール作成
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      frequency,
      intervalValue,
      daysOfWeek,
      daysOfMonth,
      timeOfDay,
      timezone = 'Asia/Tokyo',
      templateId,
      contentPattern,
      rotateContent,
      contentPool,
      startDate,
      endDate
    } = body;

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // 必須フィールドチェック
    if (!name || !frequency || !timeOfDay || !startDate) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // 次回実行時刻を計算
    const nextExecutionAt = calculateNextExecution({
      frequency,
      intervalValue: intervalValue || 1,
      daysOfWeek,
      daysOfMonth,
      timeOfDay,
      startDate,
      timezone
    });

    // スケジュールを作成
    const { data: schedule, error } = await supabase
      .from('recurring_schedules')
      .insert({
        workspace_id: workspaceId,
        name,
        description,
        frequency,
        interval_value: intervalValue || 1,
        days_of_week: daysOfWeek,
        days_of_month: daysOfMonth,
        time_of_day: timeOfDay,
        timezone,
        template_id: templateId,
        content_pattern: contentPattern,
        rotate_content: rotateContent || false,
        content_pool: contentPool,
        start_date: startDate,
        end_date: endDate,
        next_execution_at: nextExecutionAt,
        created_by: user.id,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('スケジュール作成エラー:', error);
      return NextResponse.json(
        { error: 'スケジュールの作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule
    });

  } catch (error) {
    console.error('スケジュール作成エラー:', error);
    return NextResponse.json(
      { error: 'スケジュール作成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 繰り返しスケジュール更新
export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'スケジュールIDが必要です' },
        { status: 400 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // スケジュールが存在し、ワークスペースに属していることを確認
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('recurring_schedules')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !existingSchedule) {
      return NextResponse.json(
        { error: 'スケジュールが見つかりません' },
        { status: 404 }
      );
    }

    // 次回実行時刻を再計算
    if (updateData.frequency || updateData.timeOfDay || updateData.startDate) {
      updateData.next_execution_at = calculateNextExecution({
        frequency: updateData.frequency,
        intervalValue: updateData.interval_value || 1,
        daysOfWeek: updateData.days_of_week,
        daysOfMonth: updateData.days_of_month,
        timeOfDay: updateData.time_of_day,
        startDate: updateData.start_date,
        timezone: updateData.timezone || 'Asia/Tokyo'
      });
    }

    // スケジュールを更新
    const { data: schedule, error } = await supabase
      .from('recurring_schedules')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('スケジュール更新エラー:', error);
      return NextResponse.json(
        { error: 'スケジュールの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      schedule
    });

  } catch (error) {
    console.error('スケジュール更新エラー:', error);
    return NextResponse.json(
      { error: 'スケジュール更新中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 繰り返しスケジュール削除
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'スケジュールIDが必要です' },
        { status: 400 }
      );
    }

    // 現在のワークスペースIDを取得
    const workspaceId = req.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'ワークスペースIDが必要です' },
        { status: 400 }
      );
    }

    // スケジュールを削除（ワークスペースの所有権を確認）
    const { error } = await supabase
      .from('recurring_schedules')
      .delete()
      .eq('id', scheduleId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('スケジュール削除エラー:', error);
      return NextResponse.json(
        { error: 'スケジュールの削除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'スケジュールを削除しました'
    });

  } catch (error) {
    console.error('スケジュール削除エラー:', error);
    return NextResponse.json(
      { error: 'スケジュール削除中にエラーが発生しました' },
      { status: 500 }
    );
  }
}

// 次回実行時刻を計算するヘルパー関数
function calculateNextExecution(params: {
  frequency: string;
  intervalValue: number;
  daysOfWeek?: number[];
  daysOfMonth?: number[];
  timeOfDay: string;
  startDate: string;
  timezone: string;
}): string {
  const { frequency, intervalValue, daysOfWeek, daysOfMonth, timeOfDay, startDate, timezone } = params;
  
  // 開始日時を作成
  const start = new Date(`${startDate}T${timeOfDay}`);
  const now = new Date();
  
  // 現在時刻より前の場合は、現在時刻から計算
  let nextExecution = start > now ? start : now;
  
  switch (frequency) {
    case 'daily':
      // 日次: intervalValue日ごと
      if (start <= now) {
        const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const cyclesSinceStart = Math.floor(daysSinceStart / intervalValue);
        nextExecution = new Date(start.getTime() + (cyclesSinceStart + 1) * intervalValue * 24 * 60 * 60 * 1000);
      }
      break;
      
    case 'weekly':
      // 週次: 特定の曜日
      if (daysOfWeek && daysOfWeek.length > 0) {
        const currentDay = nextExecution.getDay();
        let daysToAdd = 0;
        
        // 次の該当曜日を探す
        for (let i = 1; i <= 7; i++) {
          const checkDay = (currentDay + i) % 7;
          if (daysOfWeek.includes(checkDay)) {
            daysToAdd = i;
            break;
          }
        }
        
        if (daysToAdd > 0) {
          nextExecution.setDate(nextExecution.getDate() + daysToAdd);
        }
      } else {
        // 曜日指定なしの場合は、intervalValue週ごと
        if (start <= now) {
          const weeksSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
          const cyclesSinceStart = Math.floor(weeksSinceStart / intervalValue);
          nextExecution = new Date(start.getTime() + (cyclesSinceStart + 1) * intervalValue * 7 * 24 * 60 * 60 * 1000);
        }
      }
      break;
      
    case 'monthly':
      // 月次: 特定の日付
      if (daysOfMonth && daysOfMonth.length > 0) {
        const currentDate = nextExecution.getDate();
        const currentMonth = nextExecution.getMonth();
        const currentYear = nextExecution.getFullYear();
        
        // 今月の次の該当日を探す
        let foundThisMonth = false;
        for (const day of daysOfMonth.sort((a, b) => a - b)) {
          if (day > currentDate) {
            nextExecution = new Date(currentYear, currentMonth, day);
            foundThisMonth = true;
            break;
          }
        }
        
        // 今月に該当日がない場合は来月
        if (!foundThisMonth) {
          const nextMonth = new Date(currentYear, currentMonth + 1, 1);
          const firstDay = Math.min(...daysOfMonth);
          nextExecution = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), firstDay);
        }
      } else {
        // 日付指定なしの場合は、intervalValue月ごと
        if (start <= now) {
          const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
          const cyclesSinceStart = Math.floor(monthsSinceStart / intervalValue);
          nextExecution = new Date(start);
          nextExecution.setMonth(nextExecution.getMonth() + (cyclesSinceStart + 1) * intervalValue);
        }
      }
      break;
      
    default:
      // カスタムまたは不明な頻度の場合は開始日時をそのまま使用
      break;
  }
  
  // 時刻を設定
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  nextExecution.setHours(hours, minutes, 0, 0);
  
  return nextExecution.toISOString();
}