import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/supabase';

// SMS4FREE API Configuration
const SMS_API_URL = 'https://api.sms4free.co.il/ApiSMS/v2/SendSMS';
const SMS_KEY = 'NdJLEt3aR';
const SMS_USER = '0528842308'; 
const SMS_PASS = '63434852';
const SMS_SENDER = 'AdarNails'; 

// Helper function to format phone number to 9725XXXXXXXX format
function formatPhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (!digits.startsWith('972')) {
    digits = '972' + digits;
  }
  return digits;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code, customerName, message, isDirectMessage } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const formattedPhone = formatPhoneNumber(phone);
    
    // לוגיקת בחירת ההודעה:
    // אם יש הודעה מוכנה (isDirectMessage), נשתמש בה. אחרת, נשתמש בקוד אימות.
    let finalMessage = '';
    if (isDirectMessage && message) {
      finalMessage = message;
    } else if (code) {
      finalMessage = `קוד האימות שלך לאדר הוא: ${code}`;
    } else {
      return NextResponse.json({ error: 'Code or message is required' }, { status: 400 });
    }

    const payload = {
      key: SMS_KEY,
      user: SMS_USER,
      pass: SMS_PASS,
      sender: SMS_SENDER,
      recipient: formattedPhone,
      msg: finalMessage,
    };

    console.log('Sending SMS to:', formattedPhone);

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch (e) {
      const text = await response.text();
      result = { message: text || 'Unknown error' };
    }

    if (response.ok) {
      // בדיקת הצלחה לפי הפורמט של SMS4FREE
      const isSuccess = result.status === 'success' || result.success === true || response.status === 200;
      
      if (isSuccess) {
        await logActivity('sms_sent', `SMS נשלח ל-${phone}`);
        return NextResponse.json({ success: true });
      }
    }
    
    console.error('SMS API Error:', result);
    return NextResponse.json({ error: 'Failed to send SMS', details: result }, { status: 500 });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}