'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, Booking } from '@/lib/supabase';

export default function CancelBookingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    fetchBookingByToken();
  }, [token]);

  const fetchBookingByToken = async () => {
    if (!token) {
      setError('לא נמצא קישור ביטול תקין');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('cancellation_token', token)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
        setError('לא נמצא תור עם הקישור הזה');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('לא נמצא תור עם הקישור הזה');
        setLoading(false);
        return;
      }

      // Check if already cancelled
      if (data.status === 'cancelled') {
        setCancelled(true);
        setBooking(data);
        setLoading(false);
        return;
      }

      setBooking(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error:', err);
      setError('אירעה שגיאה בטעינת התור');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking || !token) return;

    setCancelling(true);
    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('cancellation_token', token);

      if (updateError) {
        console.error('Error cancelling booking:', updateError);
        setError('אירעה שגיאה בביטול התור. נא לנסות שוב.');
        setCancelling(false);
        return;
      }

      setCancelled(true);
      setCancelling(false);
    } catch (err: any) {
      console.error('Error:', err);
      setError('אירעה שגיאה בביטול התור');
      setCancelling(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const hebrewMonths = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-xl text-[#2c2c2c]">טוען פרטי תור...</div>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-red-500 text-xl mb-4">⚠</div>
          <h1 className="text-2xl font-medium text-[#2c2c2c]">שגיאה</h1>
          <p className="text-[#666666]">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-sm transition-colors"
          >
            חזרה לעמוד הראשי
          </button>
        </div>
      </div>
    );
  }

  if (cancelled && booking) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-light tracking-tight text-[#2c2c2c]">
              Adar Cosmetics
            </h1>
          </div>

          <div className="border border-[#c9a961] rounded-lg bg-white p-8 shadow-sm text-center">
            <div className="space-y-4">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-2xl font-medium text-[#2c2c2c]">התור בוטל בהצלחה</h2>
              <p className="text-[#666666]">התור בוטל במערכת. נוכל לקבע תור חדש בכל עת.</p>
              
              {booking && (
                <div className="bg-[#f5f5f5] rounded-lg p-4 mt-4 text-right">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#666666]">שירות:</span>
                      <span className="text-[#2c2c2c] font-medium">{booking.service_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666666]">תאריך:</span>
                      <span className="text-[#2c2c2c] font-medium">{formatDate(booking.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#666666]">שעה:</span>
                      <span className="text-[#2c2c2c] font-medium">{booking.start_time} - {booking.end_time}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-4">
                <button
                  onClick={() => router.push('/')}
                  className="px-8 py-3 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-sm font-medium transition-all duration-200 uppercase text-sm"
                >
                  חזרה לעמוד הראשי
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-[#2c2c2c]">
            Adar Cosmetics
          </h1>
        </div>

        <div className="border border-[#e0e0e0] rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-medium text-[#2c2c2c] mb-6 text-center">ביטול תור</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div className="bg-[#f5f5f5] rounded-lg p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#666666]">שירות:</span>
                <span className="text-[#2c2c2c] font-medium">{booking.service_title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#666666]">תאריך:</span>
                <span className="text-[#2c2c2c] font-medium">{formatDate(booking.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#666666]">שעה:</span>
                <span className="text-[#2c2c2c] font-medium">{booking.start_time} - {booking.end_time}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#666666]">שם:</span>
                <span className="text-[#2c2c2c] font-medium">{booking.customer_name}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className={`
                w-full px-6 py-3 rounded-sm font-medium transition-all duration-200 uppercase text-sm
                ${cancelling
                  ? 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-sm hover:shadow-md'
                }
              `}
            >
              {cancelling ? 'מבטל...' : 'אשר ביטול תור'}
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full px-6 py-3 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-sm font-medium transition-all duration-200"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

