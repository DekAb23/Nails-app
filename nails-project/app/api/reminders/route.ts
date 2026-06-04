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

    if (error) throw error;

    if (!todaysBookings || todaysBookings.length === 0) {
      return NextResponse.json({ success: true, message: `No bookings found for today (${todayStr})` });
    }

    let sentCount = 0;
    const processedReminders = [];

    // 3. מעבר על התורים וסינון חלון הזמן היעיל (25-35 דקות לפני)
    for (const booking of todaysBookings) {
      // הגנה מוחלטת מכפל שליחות
      if (booking.verification_code && booking.verification_code.includes('rem-sent')) {
        continue;
      }

      const bookingMinutes = timeToMinutes(booking.start_time);
      const minutesUntilBooking = bookingMinutes - currentMinutes;

      // 🎯 החלון האידיאלי: תופס את הלקוחה בטווח של 25 עד 35 דקות לפני הטיפול
      if (minutesUntilBooking >= 25 && minutesUntilBooking <= 35) {
        // ניקוי השעה לתצוגה אלגנטית בלי השניות (מציג 16:30 במקום 16:30:00)
        const formattedTime = booking.start_time.slice(0, 5);
        
        // הנוסח החסכוני והרשמי (SMS בודד)
        const reminderMessage = `היי, תזכורת לתור שלך היום אצל אדר קוסמטיקס בשעה ${formattedTime}. נתראה! 💕`;

        // שליחת ה-SMS באמצעות ה-API הקיים שלך
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
      details: processedReminders 
    });

  } catch (err: any) {
    console.error('Reminder cron error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}