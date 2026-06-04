import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    // 1. חילוץ שעה ותאריך נוכחיים המותאמים בדיוק לשעון ישראל (עוקף את שעון השרת הזר)
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    const ilDateStr = new Date().toLocaleString('en-US', options);
    const nowIL = new Date(ilDateStr);

    // יצירת תאריך בפורמט yyyy-MM-dd
    const year = nowIL.getFullYear();
    const month = String(nowIL.getMonth() + 1).padStart(2, '0');
    const day = String(nowIL.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // השעה הנוכחית בישראל (HH:MM)
    const currentHours = String(nowIL.getHours()).padStart(2, '0');
    const currentMinutes = String(nowIL.getMinutes()).padStart(2, '0');
    const startTimeRange = `${currentHours}:${currentMinutes}`;

    // חישוב חלון זמן של עד 45 דקות קדימה לפי שעון ישראל
    const maxTimeAhead = new Date(nowIL.getTime() + 45 * 60 * 1000);
    const maxHours = String(maxTimeAhead.getHours()).padStart(2, '0');
    const maxMinutes = String(maxTimeAhead.getMinutes()).padStart(2, '0');
    const endTimeRange = `${maxHours}:${maxMinutes}`;

    // 2. שאילתה ל-Supabase: שליפת תורים להיום שנמצאים בחלון הזמן הקרוב
    const { data: upcomingBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', todayStr)
      .eq('status', 'confirmed')
      .neq('service_id', 'verification')
      .gte('start_time', startTimeRange)
      .lte('start_time', endTimeRange);

    if (error) throw error;

    if (!upcomingBookings || upcomingBookings.length === 0) {
      return NextResponse.json({ success: true, message: `No reminders needed for range ${startTimeRange} - ${endTimeRange}` });
    }

    let sentCount = 0;

    // 3. לולאת שליחה לכל לקוחה רלוונטית
    for (const booking of upcomingBookings) {
      // מניעת כפל שליחות
      if (booking.verification_code && booking.verification_code.includes('rem-sent')) {
        continue;
      }

      const formattedTime = booking.start_time.slice(0, 5);
      const reminderMessage = `היי, תזכורת לתור שלך היום אצל אדר קוסמטיקס בשעה ${formattedTime}. נתראה! 💕`;

      // קריאה ל-API הקיים של ה-SMS באפליקציה שלך
      const smsResponse = await fetch(`${new URL(request.url).origin}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: booking.customer_phone,
          message: reminderMessage,
          isDirectMessage: true
        })
      });

      if (smsResponse.ok) {
        // עדכון ב-DB שהתזכורת נשלחה
        await supabase
          .from('bookings')
          .update({ verification_code: `rem-sent-${Date.now()}` })
          .eq('id', booking.id);
          
        sentCount++;
      }
    }

    return NextResponse.json({ success: true, remindersSent: sentCount });

  } catch (err: any) {
    console.error('Reminder cron error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}