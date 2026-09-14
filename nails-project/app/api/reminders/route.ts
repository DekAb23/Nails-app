import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// פונקציית עזר חסינה שמטפלת גם בפורמט עם שניות (HH:MM:SS) וגם בלי (HH:MM)
const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
};

// פונקציית עזר לשליחה בטוחה של SMS עם הגבלת זמן (Timeout של 6 שניות)
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
    // 1. חילוץ הזמן הנוכחי המדויק בישראל
    const options = { timeZone: 'Asia/Jerusalem', hour12: false };
    const ilDateStr = new Date().toLocaleString('en-US', options);
    const nowIL = new Date(ilDateStr);

    // יצירת פורמט תאריך נקי: yyyy-MM-dd
    const year = nowIL.getFullYear();
    const month = String(nowIL.getMonth() + 1).padStart(2, '0');
    const day = String(nowIL.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // חישוב הזמן הנוכחי בדקות מהחצות
    const currentMinutes = nowIL.getHours() * 60 + nowIL.getMinutes();

    // 2. שליפת כל התורים הפעילים של היום
    const { data: todaysBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', todayStr)
      .eq('status', 'confirmed')
      .neq('service_id', 'verification');

    if (error) {
      console.error('Supabase fetch error in reminders:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }

    if (!todaysBookings || todaysBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No bookings found for today (${todayStr})`,
      });
    }

    let sentCount = 0;
    const processedReminders = [];
    const origin = new URL(request.url).origin;

    // 3. מעבר על התורים וסינון חלון הזמן היעיל (25-35 דקות לפני)
    for (const booking of todaysBookings) {
      // הגנה מוחלטת מכפל שליחות
      if (booking.verification_code && booking.verification_code.includes('rem-sent')) {
        continue;
      }

      const bookingMinutes = timeToMinutes(booking.start_time);
      const minutesUntilBooking = bookingMinutes - currentMinutes;

      // החלון האידיאלי: תופס את הלקוחה בטווח של 25 עד 35 דקות לפני הטיפול
      if (minutesUntilBooking >= 25 && minutesUntilBooking <= 35) {
        const formattedTime = booking.start_time.slice(0, 5);
        const reminderMessage = `היי, תזכורת לתור שלך היום אצל אדר קוסמטיקס בשעה ${formattedTime}. נתראה! 💕`;

        const isSuccess = await sendSafeSMS(origin, booking.customer_phone, reminderMessage);

        if (isSuccess) {
          // חסימת התור ב-Database כדי שלא יישלח שוב בריצה הבאה
          await supabase
            .from('bookings')
            .update({ verification_code: `rem-sent-${Date.now()}` })
            .eq('id', booking.id);

          sentCount++;
          processedReminders.push({ customer: booking.customer_name, time: formattedTime });
        }
      }
    }

    return NextResponse.json({
      success: true,
      currentTime: `${String(nowIL.getHours()).padStart(2, '0')}:${String(nowIL.getMinutes()).padStart(2, '0')}`,
      remindersSent: sentCount,
      details: processedReminders,
    });
  } catch (err: any) {
    console.error('Reminder cron error:', err);
    // מחזירים 200 כדי שה-Cron Job לא יקבל 500 וישלח מיילים
    return NextResponse.json(
      { success: false, error: err.message || 'Internal cron error' },
      { status: 200 }
    );
  }
}