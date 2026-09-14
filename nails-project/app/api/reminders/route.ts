import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// פונקציית עזר לשליחה בטוחה של SMS עם הגבלת זמן
async function sendSafeSMS(origin: string, phone: string, message: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const smsResponse = await fetch(`${origin}/api/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message,
        isDirectMessage: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!smsResponse.ok) {
      console.error(`SMS endpoint returned status ${smsResponse.status} for ${phone}`);
      return false;
    }

    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`Failed to send SMS to ${phone}:`, err.message || err);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // 1. חישוב התאריך של מחר לפי שעון ישראל
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    const ilDateStr = new Date().toLocaleString('en-US', options);
    const nowIL = new Date(ilDateStr);

    const tomorrow = new Date(nowIL);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${year}-${month}-${day}`;

    // 2. שליפת כל התורים המאושרים של מחר שעדיין לא קיבלו תזכורת
    const { data: tomorrowBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', tomorrowStr)
      .eq('status', 'confirmed')
      .neq('service_id', 'verification');

    if (error) {
      console.error('Supabase fetch error in reminders:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }

    if (!tomorrowBookings || tomorrowBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No bookings found for tomorrow (${tomorrowStr})`,
        tomorrow: tomorrowStr,
      });
    }

    let sentCount = 0;
    const processedReminders = [];
    const origin = new URL(request.url).origin;

    // 3. מעבר על כל התורים של מחר ושליחת התזכורת
    for (const booking of tomorrowBookings) {
      // הגנה מכפל שליחות
      if (booking.verification_code && booking.verification_code.includes('rem-sent')) {
        continue;
      }

      const formattedTime = (booking.start_time || '').slice(0, 5);
      const firstName = (booking.customer_name || 'לקוחה').trim().split(' ')[0];

      // הודעה קצרה וממוקדת (מתחת ל-70 תווים = SMS בודד)
      const reminderMessage = `היי ${firstName}, תזכורת לתור שלך מחר ב-${formattedTime} אצל אדר קוסמטיקס 💕`;

      const isSuccess = await sendSafeSMS(origin, booking.customer_phone, reminderMessage);

      if (isSuccess) {
        // סימון התור ב-DB למניעת שליחה חוזרת
        await supabase
          .from('bookings')
          .update({ verification_code: `rem-sent-${Date.now()}` })
          .eq('id', booking.id);

        sentCount++;
        processedReminders.push({ customer: booking.customer_name, time: formattedTime });
      }
    }

    return NextResponse.json({
      success: true,
      executionDate: `${year}-${month}-${day}`,
      tomorrow: tomorrowStr,
      remindersSent: sentCount,
      details: processedReminders,
    });
  } catch (err: any) {
    console.error('Reminder cron error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal cron error' },
      { status: 200 }
    );
  }
}