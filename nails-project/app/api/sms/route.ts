import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/supabase';

// SMS4FREE API Configuration
const SMS_API_URL = 'https://api.sms4free.co.il/ApiSMS/v2/SendSMS';
const SMS_KEY = 'NdJLEt3aR';
const SMS_USER = '0528842308'; // Using phone number as username
const SMS_PASS = '63434852';
const SMS_SENDER = 'AdarNails'; // Sender name as configured in SMS4FREE dashboard

// Helper function to format phone number to 9725XXXXXXXX format
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  // If doesn't start with 972, add it
  if (!digits.startsWith('972')) {
    digits = '972' + digits;
  }
  
  return digits;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code, customerName } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Phone number and code are required' },
        { status: 400 }
      );
    }

    // Format phone number (ensure 9725XXXXXXXX format, no +, no leading 0)
    const formattedPhone = formatPhoneNumber(phone);
    
    // Prepare SMS message
    const message = `קוד האימות שלך לאדר הוא: ${code}`;

    // Prepare payload
    const payload = {
      key: SMS_KEY,
      user: SMS_USER,
      pass: SMS_PASS,
      sender: SMS_SENDER,
      recipient: formattedPhone,
      msg: message,
    };

    // Debug log
    console.log('SMS Payload:', JSON.stringify(payload, null, 2));

    // Call SMS4FREE API
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let result;
    try {
      result = await response.json();
    } catch (e) {
      // If response is not JSON, get text
      const text = await response.text();
      result = { message: text || 'Unknown error' };
    }

    // Debug log the response
    console.log('SMS API Response:', JSON.stringify(result, null, 2));
    console.log('SMS API Status:', response.status);

    // Log activity and return response
    if (response.ok) {
      // Check various possible success indicators
      const isSuccess = result.status === 'success' || 
                       result.success === true || 
                       result.code === '200' ||
                       response.status === 200;
      
      if (isSuccess) {
        await logActivity('sms_sent', `SMS נשלח בהצלחה ל-${phone} (קוד: ${code})`);
        return NextResponse.json({ success: true, message: 'SMS sent successfully' });
      } else {
        // Log exact error message
        const errorMsg = result.message || result.error || result.msg || JSON.stringify(result);
        console.error('SMS API Error:', errorMsg);
        await logActivity('sms_failed', `SMS נכשל ל-${phone}: ${errorMsg}`);
        return NextResponse.json(
          { error: 'Failed to send SMS', details: result },
          { status: 500 }
        );
      }
    } else {
      // Log exact error message
      const errorMsg = result.message || result.error || result.msg || `HTTP ${response.status}`;
      console.error('SMS API Error:', errorMsg);
      console.error('SMS API Full Response:', JSON.stringify(result, null, 2));
      await logActivity('sms_failed', `SMS נכשל ל-${phone}: ${errorMsg}`);
      return NextResponse.json(
        { error: 'Failed to send SMS', details: result },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    await logActivity('sms_failed', `SMS נכשל: ${error.message || 'Unknown error'}`);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
