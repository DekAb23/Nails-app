import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// יצירת חיבור שרת מאובטח ל-Supabase מתוך משתני הסביבה
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    // 1. קביעת הזמן הנוכחי וחישוב המטרה (בעוד 30 דקות מהרגע)
    const now = new Date();
    
    // שליפת התאריך הנוכחי בפורמט שה-DB מכיר (yyyy-MM-dd)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // חישוב השעה המדויקת של עוד 30 דקות מהיום
    const reminderTargetTime = new Date(now.getTime() + 30 * 60 * 1000);
    const targetHours = String(reminderTargetTime.getHours()).padStart(2, '0');
    const targetMinutes = String(reminderTargetTime.getMinutes()).padStart(2, '0');
    
    // השעה שנוח להשוות מול בסיס הנתונים (HH:MM), למשל: "16:30"
    const targetTimeStr = `${targetHours}:${targetMinutes}`;

    // הגדרת טווח בדיקה בטוח (בין 25 דקות ל-35 דקות מהרגע) כדי למנוע פספוסים בגלל ריצת ה-Cron
    const timeAhead5 = new Date(now.getTime() + 25 * 60 * 1000);
    const timeAhead15 = new Date(now.getTime() + 35 * 60 * 1000);
    
    const formatTimeStr = (d: Date) => 
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    
    const startTimeRange = formatTimeStr(timeAhead5);
    const endTimeRange = formatTimeStr(timeAhead15);

    // 2. שאילתה ל-Supabase: שליפת תורים להיום שמתחילים בחלון הזמן הרלוונטי
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
      return NextResponse.json({ success: true, message: 'No reminders needed at this window.' });
    }

    let sentCount = 0;

    // 3. לולאת שליחה לכל לקוחה שעונה על הדרישות
    for (const booking of upcomingBookings) {
      // בדיקה אבטחתית: וודאי שהודעה זו לא נשלחה כבר בקריאה קודמת (באמצעות שדה ה-metadata של קוד האימות הישן)
      // אנחנו משתמשים בטריק פנימי: אם הקוד מכיל את המלל 'rem-sent', סימן שכבר שלחנו לה תזכורת
      if (booking.verification_code && booking.verification_code.includes('rem-sent')) {
        continue;
      }

      // חיתוך זמנים קל לצורך ההודעה
      const formattedTime = booking.start_time.slice(0, 5);

      // 🏆 הנוסח המושלם והחסכוני שלך: בדיוק 64 תווים = SMS בודד וקולע!
      const reminderMessage = `היי, תזכורת לתור שלך אצל אדר קוסמטיקס בעוד חצי שעה. נתראה! 💕`;

      // קריאה ל-API הקיים של ה-SMS שלך
      const smsResponse = await fetch(`${new URL(request.url).origin}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: booking.customer_phone,
          message: reminderMessage,
          isDirectMessage: true // עקיפת קוד אימות רגיל
        })
      });

      if (smsResponse.ok) {
        // עדכון סטטוס בתוך הרשומה שהתזכורת נשלחה בהצלחה (כדי שלא תישלח שוב)
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