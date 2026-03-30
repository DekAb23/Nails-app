'use client';

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { SiWaze } from 'react-icons/si';
import { Instagram } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { supabase, Booking, BlockedDate, BlockedTimeSlot, DailySchedule, logActivity } from '@/lib/supabase';
import { isPhoneVerified, createVerifiedSession, clearAllSessions, getAllVerifiedPhones } from '@/lib/session';

type Step = 'services' | 'calendar' | 'contact' | 'verification' | 'success';

interface Activity {
  id: string;
  type: 'booking_created' | 'booking_cancelled' | 'date_blocked' | 'date_unblocked';
  message: string;
  timestamp: Date;
}

export default function Home() {
  const [step, setStep] = useState<Step>('services');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [cancellationLink, setCancellationLink] = useState<string | null>(null);
  
  // Verification state
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string>('');
  
  // My Appointments Modal State
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [appointmentsPhone, setAppointmentsPhone] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Booking[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [appointmentsVerified, setAppointmentsVerified] = useState(false);
  const [appointmentsVerificationCode, setAppointmentsVerificationCode] = useState<string>('');
  const [appointmentsVerifying, setAppointmentsVerifying] = useState(false);
  const [appointmentsVerificationError, setAppointmentsVerificationError] = useState<string>('');
  const [appointmentsNeedsVerification, setAppointmentsNeedsVerification] = useState(false);
  
  // Blocked dates state
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(false);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);

  const services = [
    {
      id: 'anatomical-gel',
      title: "מבנה אנטומי - ג'ל בנייה",
      price: "150 ₪",
      duration: "90 דקות",
      durationMinutes: 90,
    },
    {
      id: 'anatomical-gel-extended',
      title: "בנייה חדשה בטיפס ג'ל",
      price: "250 ₪",
      duration: "150 דקות",
      durationMinutes: 150,
    },
    {
      id: 'gel-pedicure',
      title: "לק ג'ל רגליים",
      price: "100 ₪",
      duration: "40 דקות",
      durationMinutes: 40,
    },
    {
      id: 'eyebrows-mustache',
      title: "גבות / שפם",
      price: "60 ₪",
      duration: "20 דקות",
      durationMinutes: 20,
    },
  ];

  const selectedServiceData = services.find(s => s.id === selectedService);

  // --- פונקציית שליחת התראות מעודכנת ---
  const sendConfirmationNotifications = async (booking: any) => {
    const formattedDate = format(parseDateString(booking.date), 'dd/MM');
    
    // הודעה ללקוחה בפורמט החדש עם הקישור לאינסטגרם בסוף
    const customerMessage = `שלום ${booking.customer_name}, 
נקבע לך תור אצל Adar Cosmetics
${booking.service_title}
בתאריך ${formattedDate} בשעה ${booking.start_time}
בכתובת מור 5 א', קומה 6 דירה 25.

שימי לב- אי הגעה לתור או ביטול בפחות מ24 שעות מותנה בתשלום של 50% מסך הטיפול. 

קישור לאינסטגרם:
https://www.instagram.com/adar_abergel_cosmetics?igsh=MWd5aXlyaDV4dHMwZA==`;

    const adarMessage = `אדר, נקבע תור חדש!
לקוחה: ${booking.customer_name}
טיפול: ${booking.service_title}
זמן: ${formattedDate} ב-${booking.start_time}
טלפון: ${booking.customer_phone}`;

    try {
      // שליחה ללקוחה
      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: booking.customer_phone,
          message: customerMessage,
          isDirectMessage: true 
        }),
      });

      // שליחה לאדר
      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '0508917748',
          message: adarMessage,
          isDirectMessage: true
        }),
      });
    } catch (error) {
      console.error('Notification error:', error);
    }
  };

  useEffect(() => {
    fetchBlockedDates();
  }, []);

  useEffect(() => {
    if (showMyAppointments) {
      const verifiedPhones = getAllVerifiedPhones();
      if (verifiedPhones.length > 0) {
        const verifiedPhone = verifiedPhones[0];
        setAppointmentsPhone(verifiedPhone);
        fetchMyAppointments(verifiedPhone, true);
      }
    }
  }, [showMyAppointments]);

  useEffect(() => {
    if (selectedDate) {
      fetchBookings(selectedDate);
      fetchBlockedTimeSlotsForDate(selectedDate);
      fetchDailyScheduleForDate(selectedDate);
    } else {
      setBookings([]);
      setBlockedTimeSlots([]);
      setDailySchedule(null);
    }
  }, [selectedDate]);

  const fetchBlockedDates = async () => {
    setLoadingBlockedDates(true);
    try {
      const { data } = await supabase.from('blocked_dates').select('*');
      setBlockedDates(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingBlockedDates(false);
    }
  };

  const fetchBlockedTimeSlotsForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data } = await supabase.from('blocked_time_slots').select('*').eq('date', dateStr).order('start_time', { ascending: true });
      setBlockedTimeSlots(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchDailyScheduleForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase.from('daily_schedules').select('*').eq('date', dateStr).single();
      if (error && error.code !== 'PGRST116') console.error('Error fetching daily schedule:', error);
      else setDailySchedule(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchBookings = async (date: Date) => {
    setLoadingBookings(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data } = await supabase.from('bookings').select('*').eq('date', dateStr).neq('status', 'cancelled').order('start_time', { ascending: true });
      setBookings((data || []).filter(booking => booking.status !== 'cancelled'));
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const disabledDates = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const maxDate = new Date(); maxDate.setMonth(maxDate.getMonth() + 2);
    const blockedDateObjects = blockedDates.map(bd => parseDateString(bd.date));
    return [{ before: today }, { after: maxDate }, { dayOfWeek: [6] }, ...blockedDateObjects];
  }, [blockedDates]);

  const availableSlots = useMemo(() => {
    if (!selectedServiceData || !selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    if (blockedDates.some(bd => bd.date === dateStr)) return [];
    const timeToMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const formatTime = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; };
    const dayOfWeek = selectedDate.getDay();
    let workingStartMinutes = 9 * 60;
    let workingEndMinutes = dayOfWeek === 5 ? 12 * 60 : 18 * 60;
    if (dailySchedule) { workingStartMinutes = timeToMinutes(dailySchedule.start_time); workingEndMinutes = timeToMinutes(dailySchedule.end_time); }
    if (dayOfWeek === 6 && !dailySchedule) return [];
    const dateBlockedSlots = blockedTimeSlots.filter(bt => bt.date === dateStr).map(bt => ({ start: timeToMinutes(bt.start_time), end: timeToMinutes(bt.end_time) })).sort((a, b) => a.start - b.start);
    const duration = selectedServiceData.durationMinutes;
    const slots = [];
    const availableWindows = [];
    let currentPos = workingStartMinutes;
    for (const blocked of dateBlockedSlots) { if (blocked.start > currentPos) availableWindows.push({ start: currentPos, end: Math.min(blocked.start, workingEndMinutes) }); currentPos = Math.max(currentPos, blocked.end); }
    if (currentPos < workingEndMinutes) availableWindows.push({ start: currentPos, end: workingEndMinutes });
    for (const window of availableWindows) {
      let windowStart = window.start;
      while (windowStart + duration <= window.end) {
        const slotEnd = windowStart + duration;
        const startTime = formatTime(windowStart);
        const endTime = formatTime(slotEnd);
        const overlaps = bookings.some(b => windowStart < timeToMinutes(b.end_time) && slotEnd > timeToMinutes(b.start_time));
        if (!overlaps) slots.push({ start: startTime, end: endTime, key: `${startTime}-${endTime}` });
        windowStart = slotEnd;
      }
    }
    const today = new Date();
    if (format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      return slots.filter(slot => timeToMinutes(slot.start) >= currentMinutes);
    }
    return slots;
  }, [selectedServiceData, selectedDate, blockedTimeSlots, blockedDates, bookings, dailySchedule]);

  const formatDate = (date: Date): string => `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  const getSelectedTimeSlotText = (): string => {
    if (!selectedTime) return '';
    const selectedSlot = availableSlots.find(slot => slot.key === selectedTime);
    return selectedSlot ? `${selectedSlot.start} - ${selectedSlot.end}` : '';
  };

  const handleContinue = () => { if (selectedService) setStep('calendar'); };
  const handleBack = () => {
    if (step === 'contact') setStep('calendar');
    else if (step === 'verification') setStep('contact');
    else if (step === 'success') { setStep('services'); setSelectedService(null); setSelectedDate(null); setSelectedTime(null); setCustomerName(''); setCustomerPhone(''); }
    else setStep('services');
  };
  const handleConfirmBooking = () => { if (selectedDate && selectedTime) setStep('contact'); };
  const isValidPhoneNumber = (phone: string): boolean => { const digits = phone.replace(/\D/g, ''); return digits.length >= 9 && digits.length <= 10 && /^05/.test(digits); };
  const isFormValid = customerName.trim().length > 0 && isValidPhoneNumber(customerPhone);

  const handleWhatsAppBooking = async () => {
    if (!selectedServiceData || !selectedDate || !selectedTime || !customerName || !isFormValid) return;
    setSavingBooking(true);
    try {
      const selectedSlot = availableSlots.find(slot => slot.key === selectedTime);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const phoneDigits = customerPhone.replace(/\D/g, '');
      const hasActiveSession = isPhoneVerified(phoneDigits);
      let vCode = ''; let isVerified = hasActiveSession;
      if (!hasActiveSession) {
        vCode = Math.floor(1000 + Math.random() * 9000).toString();
        await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: vCode, customerName: customerName.trim() }) });
      }
      const newBooking = { service_id: selectedServiceData.id, service_title: selectedServiceData.title, service_duration: selectedServiceData.durationMinutes, date: dateStr, start_time: selectedSlot!.start, end_time: selectedSlot!.end, customer_name: customerName.trim(), customer_phone: phoneDigits, cancellation_token: uuidv4(), status: 'confirmed', is_verified: isVerified, verification_code: vCode || undefined };
      const { data, error } = await supabase.from('bookings').insert([newBooking]).select().single();
      if (error) throw error;
      if (data?.id) {
        if (hasActiveSession) {
          await logActivity('verified', `לקוחה מוכרת: ${customerName.trim()}`);
          await sendConfirmationNotifications(data);
          if (selectedDate) fetchBookings(selectedDate);
          setStep('success');
        } else {
          setCurrentBookingId(data.id);
          setStep('verification');
        }
      }
    } catch (error) { console.error('Booking error:', error); }
    finally { setSavingBooking(false); }
  };

  const handleVerification = async () => {
    if (!currentBookingId || !verificationCode) return;
    setVerifying(true);
    try {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: verificationCode, bookingId: currentBookingId }) });
      const result = await res.json();
      if (result.verified) {
        createVerifiedSession(phoneDigits);
        const { data } = await supabase.from('bookings').select('*').eq('id', currentBookingId).single();
        if (data) await sendConfirmationNotifications(data);
        if (selectedDate) fetchBookings(selectedDate);
        setStep('success');
      } else setVerificationError('קוד אימות שגוי');
    } catch (error) { console.error('Verification error:', error); }
    finally { setVerifying(false); }
  };

  const fetchMyAppointments = async (phone: string, skipVerification = false) => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (!skipVerification && !isPhoneVerified(phoneDigits)) {
      setAppointmentsNeedsVerification(true);
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      try {
        await supabase.from('bookings').insert([{ service_id: 'verification_only', service_title: 'אימות', service_duration: 0, date: '1970-01-01', start_time: '00:00', end_time: '00:00', customer_name: 'אימות', customer_phone: phoneDigits, verification_code: code, is_verified: false, status: 'pending', cancellation_token: uuidv4() }]);
        await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code, customerName: 'לקוח' }) });
      } catch (e) { console.error(e); }
      return;
    }
    setLoadingAppointments(true);
    try {
      const { data } = await supabase.from('bookings').select('*').eq('customer_phone', phoneDigits).neq('service_id', 'verification_only').in('status', ['pending', 'confirmed']).order('date', { ascending: true });
      setMyAppointments(data || []);
      setAppointmentsVerified(true);
    } finally { setLoadingAppointments(false); }
  };

  const handleSearchAppointments = () => { if (isValidPhoneNumber(appointmentsPhone)) fetchMyAppointments(appointmentsPhone); else alert('טלפון לא תקין'); };
  
  const handleAppointmentsVerification = async () => {
    if (appointmentsVerificationCode.length !== 4) return;
    setAppointmentsVerifying(true);
    try {
      const phoneDigits = appointmentsPhone.replace(/\D/g, '');
      const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: appointmentsVerificationCode }) });
      const result = await res.json();
      if (result.verified) { createVerifiedSession(phoneDigits); await fetchMyAppointments(phoneDigits, true); setAppointmentsNeedsVerification(false); }
      else setAppointmentsVerificationError('קוד שגוי');
    } finally { setAppointmentsVerifying(false); }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('לבטל תור?')) return;
    setCancellingAppointmentId(id);
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) { fetchMyAppointments(appointmentsPhone, true); alert('בוטל בהצלחה'); }
    setCancellingAppointmentId(null);
  };

  const formatDateString = (dateStr: string): string => { const d = parseDateString(dateStr); return `${d.getDate()} ${hebrewMonths[d.getMonth()]}`; };

  return (
    <div dir="rtl" className="min-h-screen">
      {/* My Appointments Button */}
      <button
        onClick={() => { setShowMyAppointments(true); setMyAppointments([]); setAppointmentsPhone(''); setAppointmentsVerified(false); setAppointmentsNeedsVerification(false); }}
        className="fixed top-4 left-4 md:left-6 z-50 bg-[#c9a961] hover:bg-[#b8964f] text-white px-4 py-2 rounded-full shadow-lg transition-all text-sm font-medium flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        התורים שלי
      </button>

      {/* My Appointments Modal */}
      {showMyAppointments && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMyAppointments(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#c9a961] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">התורים שלי</h2>
              <button onClick={() => setShowMyAppointments(false)} className="text-white hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {appointmentsNeedsVerification ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">אימות נדרש</p>
                    <p className="text-sm text-[#666666]">נשלח קוד למספר {appointmentsPhone}</p>
                  </div>
                  <input type="text" maxLength={4} value={appointmentsVerificationCode} onChange={(e) => setAppointmentsVerificationCode(e.target.value.replace(/\D/g, ''))} placeholder="0000" className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest outline-none" dir="ltr" />
                  {appointmentsVerificationError && <p className="text-sm text-red-600">{appointmentsVerificationError}</p>}
                  <button onClick={handleAppointmentsVerification} disabled={appointmentsVerifying || appointmentsVerificationCode.length !== 4} className="w-full px-4 py-3 bg-[#c9a961] text-white rounded-lg font-medium">{appointmentsVerifying ? 'מאמת...' : 'אמת'}</button>
                  <button onClick={() => { setAppointmentsNeedsVerification(false); }} className="w-full text-sm text-[#666666]">חזור</button>
                </div>
              ) : !appointmentsVerified ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium">מספר טלפון</label>
                  <div className="flex gap-2">
                    <input type="tel" value={appointmentsPhone} onChange={(e) => setAppointmentsPhone(e.target.value)} placeholder="0501234567" className="flex-1 border rounded-lg px-4 py-3 outline-none" dir="ltr" />
                    <button onClick={handleSearchAppointments} className="px-6 py-3 bg-[#c9a961] text-white rounded-lg font-medium">חפש</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#f5f5f5] rounded-lg p-3 flex justify-between items-center text-sm">
                    <span>תורים עבור: {appointmentsPhone}</span>
                    <button onClick={() => { clearAllSessions(); setMyAppointments([]); setAppointmentsPhone(''); setAppointmentsVerified(false); }} className="text-[#c9a961] underline">החלף משתמש</button>
                  </div>
                  <div className="space-y-3">
                    {myAppointments.map((app) => (
                      <div key={app.id} className="border rounded-lg p-4">
                        <div className="space-y-1 mb-3 text-sm">
                          <div className="flex justify-between"><span>שירות:</span><span className="font-medium">{app.service_title}</span></div>
                          <div className="flex justify-between"><span>תאריך:</span><span className="font-medium">{formatDateString(app.date)}</span></div>
                          <div className="flex justify-between"><span>שעה:</span><span className="font-medium">{app.start_time}</span></div>
                        </div>
                        <button onClick={() => handleCancelAppointment(app.id!)} disabled={cancellingAppointmentId === app.id} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm">{cancellingAppointmentId === app.id ? 'מבטל...' : 'ביטול תור'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/hero-bg.jpeg" alt="Adar Cosmetics" fill priority className="object-cover" quality={90} />
        </div>
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10" />
        <div className="relative px-4 py-12 md:py-16 flex flex-col items-center justify-center min-h-[60vh] md:min-h-[70vh]">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-10 md:px-12 md:py-14 mb-8 max-w-md w-full text-center">
            <h1 className="text-4xl md:text-5xl font-playfair font-medium tracking-[0.1em] text-[#2c2c2c] mb-4">ADAR COSMETICS</h1>
            <div className="flex items-center justify-center gap-2 text-[#666666] text-sm md:text-base">מור 5, אור עקיבא</div>
          </div>
          <div className="flex items-center justify-center gap-4 md:gap-6 relative z-20">
            <a href="https://wa.me/972508917748" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center text-white text-3xl font-bold italic shadow-white/20">W</a>
            <a href="tel:0508917748" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#c9a961] shadow-lg flex items-center justify-center text-white text-3xl font-bold italic shadow-white/20">C</a>
            <a href="https://waze.com/ul?q=מור 5, אור עקיבא" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#33CCFF] shadow-lg flex items-center justify-center text-white text-3xl font-bold italic shadow-white/20">Z</a>
            <a href="https://www.instagram.com/adar_abergel_cosmetics/" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#E1306C] to-[#C13584] shadow-lg flex items-center justify-center text-white text-3xl font-bold italic shadow-white/20">I</a>
          </div>
        </div>
      </div>
      
      <main className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {step === 'services' ? (
          <div className="space-y-4">
            {services.map((s) => (
              <div key={s.id} onClick={() => setSelectedService(s.id)} className={`border rounded-lg bg-white p-6 md:p-8 cursor-pointer ${selectedService === s.id ? 'border-[#c9a961] border-2 ring-2 ring-[#c9a961]/20' : 'border-[#e0e0e0]'}`}>
                <h2 className="text-lg md:text-xl font-medium">{s.title}</h2>
                <div className="flex items-center gap-4 text-sm font-medium text-[#c9a961]"><span>{s.price}</span><span>•</span><span>{s.duration}</span></div>
              </div>
            ))}
            <div className="flex justify-center"><button onClick={handleContinue} disabled={!selectedService} className={`px-12 py-4 rounded-sm font-medium ${selectedService ? 'bg-[#c9a961] text-white shadow-md' : 'bg-[#e8e8e8] text-[#b0b0b0]'}`}>המשך לבחירת זמן</button></div>
          </div>
        ) : step === 'calendar' ? (
          <div className="space-y-8">
            <button onClick={handleBack} className="text-[#666666] flex items-center gap-2">← חזרה</button>
            <div className="flex justify-center"><DayPicker mode="single" selected={selectedDate || undefined} onSelect={(date) => { setSelectedDate(date || null); setSelectedTime(null); }} disabled={disabledDates} className="bg-white p-4 rounded-lg border" /></div>
            {selectedDate && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableSlots.length === 0 ? <div className="col-span-2 text-center py-8">אין זמנים פנויים</div> : availableSlots.map((slot) => (
                  <button key={slot.key} onClick={() => setSelectedTime(slot.key)} className={`border rounded-lg p-4 font-medium ${selectedTime === slot.key ? 'bg-[#c9a961] text-white' : 'bg-white hover:bg-[#f5f5f5]'}`}>{slot.start} - {slot.end}</button>
                ))}
              </div>
            )}
            <div className="flex justify-center pt-4"><button onClick={handleConfirmBooking} disabled={!selectedDate || !selectedTime} className={`px-12 py-4 rounded-sm font-medium ${selectedDate && selectedTime ? 'bg-[#c9a961] text-white' : 'bg-[#e8e8e8] text-[#b0b0b0]'}`}>המשך</button></div>
          </div>
        ) : step === 'contact' ? (
          <div className="space-y-8">
            <button onClick={handleBack} className="text-[#666666] flex items-center gap-2">← חזרה</button>
            <div className="space-y-4">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם מלא" className="w-full border rounded-lg px-4 py-3 outline-none focus:border-[#c9a961]" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0501234567" className="w-full border rounded-lg px-4 py-3 outline-none focus:border-[#c9a961]" dir="ltr" />
            </div>
            <div className="flex justify-center"><button onClick={handleWhatsAppBooking} disabled={!isFormValid || savingBooking} className={`px-12 py-4 rounded-sm font-medium ${isFormValid && !savingBooking ? 'bg-[#c9a961] text-white shadow-md' : 'bg-[#e8e8e8] text-[#b0b0b0]'}`}>{savingBooking ? 'שומר...' : 'אישור וקביעת תור ב-SMS'}</button></div>
          </div>
        ) : step === 'verification' ? (
          <div className="flex flex-col items-center py-10 space-y-6">
            <h2 className="text-2xl font-bold">הזן קוד אימות</h2>
            <input type="text" maxLength={4} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full max-w-[200px] border-b-4 border-[#c9a961] text-center text-4xl font-bold outline-none" dir="ltr" />
            {verificationError && <p className="text-red-500">{verificationError}</p>}
            <button onClick={handleVerification} disabled={verifying || verificationCode.length !== 4} className="w-full max-w-sm py-4 bg-[#c9a961] text-white rounded-xl font-bold shadow-lg">אמת תור</button>
          </div>
        ) : step === 'success' ? (
          <div className="text-center py-20 space-y-6 bg-green-50 rounded-2xl border border-green-100">
            <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center mx-auto text-white text-3xl">✓</div>
            <h2 className="text-3xl font-bold text-[#2c2c2c]">התור נקבע בהצלחה!</h2>
            <p className="text-[#666666] px-4">תודה שקבעת תור! שלחנו לך SMS עם הפרטים.</p>
            <button onClick={() => { setStep('services'); setSelectedService(null); setSelectedDate(null); setSelectedTime(null); setCustomerName(''); setCustomerPhone(''); }} className="px-10 py-4 bg-[#c9a961] text-white rounded-xl font-bold shadow-md">קבע תור נוסף</button>
          </div>
        ) : null}
      </main>
    </div>
  );
}