import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/supabase';

/**
 * Unified verification endpoint
 * Can be used by both booking flow and My Appointments flow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code, bookingId } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Phone number and code are required' },
        { status: 400 }
      );
    }

    const phoneDigits = phone.replace(/\D/g, '');

    // If bookingId is provided, verify against that booking
    if (bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('verification_code, customer_phone, customer_name')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        );
      }

      // Verify phone matches
      if (booking.customer_phone !== phoneDigits) {
        return NextResponse.json(
          { error: 'Phone number does not match booking' },
          { status: 403 }
        );
      }

      // Verify code
      if (booking.verification_code !== code) {
        await logActivity('verification_failed', `אימות נכשל ל-${phoneDigits}: קוד שגוי`);
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 401 }
        );
      }

      // Update booking to verified
      await supabase
        .from('bookings')
        .update({ is_verified: true })
        .eq('id', bookingId);

      await logActivity('verified', `תור אומת: ${booking.customer_name} ל-${phoneDigits}`);
      
      return NextResponse.json({
        success: true,
        verified: true,
        phone: phoneDigits,
        message: 'Verification successful'
      });
    } else {
      // For My Appointments: verify against any recent booking with this phone
      // First, try to find an unverified booking with matching code
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, verification_code, customer_name')
        .eq('customer_phone', phoneDigits)
        .eq('verification_code', code)
        .order('created_at', { ascending: false })
        .limit(1);

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
      }

      if (bookings && bookings.length > 0) {
        // Found a matching booking - verify it
        const booking = bookings[0];
        
        // Update booking to verified
        await supabase
          .from('bookings')
          .update({ is_verified: true })
          .eq('id', booking.id);

        await logActivity('verified', `אימות הצלח ל-${phoneDigits} (התורים שלי)`);
        
        return NextResponse.json({
          success: true,
          verified: true,
          phone: phoneDigits,
          message: 'Verification successful'
        });
      }

      // No matching booking found - verification failed
      await logActivity('verification_failed', `אימות נכשל ל-${phoneDigits}: קוד שגוי`);
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
