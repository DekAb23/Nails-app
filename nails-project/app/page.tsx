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
    { id: 'anatomical-gel', title: "מבנה אנטומי - ג'ל בנייה", price: "150 ₪", duration: "90 דקות", durationMinutes: 90 },
    { id: 'anatomical-gel-extended', title: "בנייה חדשה בטיפס ג'ל", price: "250 ₪", duration: "150 דקות", durationMinutes: 150 },
    { id: 'gel-pedicure', title: "לק ג'ל רגליים", price: "100 ₪", duration: "40 דקות", durationMinutes: 40 },
    { id: 'eyebrows-mustache', title: "גבות / שפם", price: "60 ₪", duration: "20 דקות", durationMinutes: 20 },
  ];

  const selectedServiceData = services.find(s => s.id === selectedService);

  // --- פונקציית שליחת התראות ---
  const sendConfirmationNotifications = async (booking: any) => {
    const formattedDate = format(parseDateString(booking.date), 'dd/MM');
    
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
      await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: booking.customer_phone,
          message: customerMessage,
          isDirectMessage: true 
        }),
      });

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
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*');

      if (error) {
        console.error('Error fetching blocked dates:', error);
      } else {
        setBlockedDates(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingBlockedDates(false);
    }
  };

  const fetchBlockedTimeSlotsForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('blocked_time_slots')
        .select('*')
        .eq('date', dateStr)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching blocked time slots:', error);
        setBlockedTimeSlots([]);
      } else {
        setBlockedTimeSlots(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      setBlockedTimeSlots([]);
    }
  };

  const fetchDailyScheduleForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('date', dateStr)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setDailySchedule(null);
        } else {
          console.error('Error fetching daily schedule:', error);
          setDailySchedule(null);
        }
      } else {
        setDailySchedule(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setDailySchedule(null);
    }
  };

  const fetchBookings = async (date: Date) => {
    setLoadingBookings(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
      } else {
        setBookings(data || []);
      }
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

    const dateBlockedSlots = blockedTimeSlots.filter(bt => bt.date === dateStr).map(bt => ({ start: timeToMinutes(bt.start_time), end: timeToMinutes(bt.end_time) }));
    const duration = selectedServiceData.durationMinutes;
    const slots = [];
    
    let currentPos = workingStartMinutes;
    while (currentPos + duration <= workingEndMinutes) {
      const slotEnd = currentPos + duration;
      const startTimeStr = formatTime(currentPos);
      const isTaken = bookings.some(b => currentPos < timeToMinutes(b.end_time) && slotEnd > timeToMinutes(b.start_time));
      const isBlocked = dateBlockedSlots.some(b => currentPos < b.end && slotEnd > b.start);
      if (!isTaken && !isBlocked) slots.push({ start: startTimeStr, end: formatTime(slotEnd), key: startTimeStr });
      currentPos += 30;
    }

    const today = new Date();
    if (format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      const nowMins = today.getHours() * 60 + today.getMinutes();
      return slots.filter(s => timeToMinutes(s.start) > nowMins);
    }
    return slots;
  }, [selectedServiceData, selectedDate, bookings, blockedTimeSlots, blockedDates, dailySchedule]);

  const handleContinue = () => { if (selectedService) setStep('calendar'); };
  const handleBack = () => {
    if (step === 'contact') setStep('calendar');
    else if (step === 'verification') setStep('contact');
    else setStep('services');
  };
  const handleConfirmBooking = () => { if (selectedDate && selectedTime) setStep('contact'); };

  const handleWhatsAppBooking = async () => {
    if (!selectedServiceData || !selectedDate || !selectedTime || !customerName || !isFormValid) return;
    setSavingBooking(true);
    try {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      const hasActiveSession = isPhoneVerified(phoneDigits);
      let vCode = '';
      if (!hasActiveSession) {
        vCode = Math.floor(1000 + Math.random() * 9000).toString();
        await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: vCode, customerName: customerName.trim() })});
      }
      const slot = availableSlots.find(s => s.key === selectedTime);
      const newBooking = { service_id: selectedServiceData.id, service_title: selectedServiceData.title, service_duration: selectedServiceData.durationMinutes, date: format(selectedDate, 'yyyy-MM-dd'), start_time: slot!.start, end_time: slot!.end, customer_name: customerName.trim(), customer_phone: phoneDigits, cancellation_token: uuidv4(), status: 'confirmed', is_verified: hasActiveSession, verification_code: vCode || undefined };
      const { data } = await supabase.from('bookings').insert([newBooking]).select().single();
      if (data) {
        if (hasActiveSession) { await sendConfirmationNotifications(data); setStep('success'); }
        else { setCurrentBookingId(data.id); setStep('verification'); }
      }
    } finally { setSavingBooking(false); }
  };

  const handleVerification = async () => {
    setVerifying(true);
    const phoneDigits = customerPhone.replace(/\D/g, '');
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: verificationCode, bookingId: currentBookingId })});
    const result = await res.json();
    if (result.verified) {
      createVerifiedSession(phoneDigits);
      const { data } = await supabase.from('bookings').select('*').eq('id', currentBookingId).single();
      if (data) await sendConfirmationNotifications(data);
      setStep('success');
    } else setVerificationError('קוד אימות שגוי');
    setVerifying(false);
  };

  const fetchMyAppointments = async (phone: string, skipVerification = false) => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (!skipVerification && !isPhoneVerified(phoneDigits)) {
      setAppointmentsNeedsVerification(true);
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('bookings').insert([{ service_id: 'verification_only', service_title: 'אימות', date: '1970-01-01', start_time: '00:00', end_time: '00:00', customer_name: 'אימות', customer_phone: phoneDigits, verification_code: code, is_verified: false, status: 'pending', cancellation_token: uuidv4() }]);
      await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code, customerName: 'לקוח' })});
      return;
    }
    setLoadingAppointments(true);
    const { data } = await supabase.from('bookings').select('*').eq('customer_phone', phoneDigits).neq('service_id', 'verification_only').in('status', ['confirmed']).order('date');
    setMyAppointments(data || []);
    setAppointmentsVerified(true);
    setLoadingAppointments(false);
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('לבטל את התור?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    fetchMyAppointments(appointmentsPhone, true);
  };

  const isValidPhoneNumber = (phone: string): boolean => { const digits = phone.replace(/\D/g, ''); return digits.length >= 9 && digits.length <= 10 && /^05/.test(digits); };
  const isFormValid = customerName.trim().length > 0 && isValidPhoneNumber(customerPhone);
  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
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
            <div className="flex items-center justify-center gap-2 text-[#666666] text-sm md:text-base">
              <svg className="w-5 h-5 text-[#c9a961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>מור 5, אור עקיבא</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4 md:gap-6 relative z-20 pointer-events-auto">
            <a href="https://wa.me/972508917748" target="_blank" rel="noopener noreferrer" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#20BA5A] shadow-lg flex items-center justify-center transition-all transform hover:scale-110">
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>
            <a href="tel:0508917748" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#c9a961] hover:bg-[#b8964f] shadow-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95">
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
            <a href="https://waze.com/ul?q=מור 5, אור עקיבא" target="_blank" rel="noopener noreferrer" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#33CCFF] hover:bg-[#2BB8E6] shadow-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95">
              <SiWaze className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </a>
            <a href="https://www.instagram.com/adar_abergel_cosmetics/" target="_blank" rel="noopener noreferrer" className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#E1306C] to-[#C13584] hover:from-[#C13584] hover:to-[#833AB4] shadow-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95">
              <Instagram className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </a>
          </div>
        </div>
      </div>
      
      <main className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {step === 'services' ? (
          <div className="space-y-4">
            {services.map((s) => (
              <div key={s.id} onClick={() => setSelectedService(s.id)} className={`border rounded-lg bg-white p-6 md:p-8 cursor-pointer transition-all ${selectedService === s.id ? 'border-[#c9a961] border-2 shadow-md ring-2 ring-[#c9a961] ring-opacity-20' : 'border-[#e0e0e0]'}`}>
                <h2 className="text-lg md:text-xl font-medium text-[#2c2c2c]">{s.title}</h2>
                <div className="flex items-center gap-4 text-sm font-medium text-[#c9a961]"><span>{s.price}</span><span>•</span><span>{s.duration}</span></div>
              </div>
            ))}
            <div className="flex justify-center pt-4">
              <button onClick={handleContinue} disabled={!selectedService} className={`px-12 py-4 rounded-sm font-medium tracking-wide transition-all uppercase text-sm ${selectedService ? 'bg-[#c9a961] text-white shadow-md' : 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed'}`}>המשך לבחירת זמן</button>
            </div>
          </div>
        ) : step === 'calendar' ? (
          <div className="space-y-8">
            <button onClick={handleBack} className="text-[#666666] flex items-center gap-2">← חזרה</button>
            <div className="flex justify-center bg-white p-4 rounded-lg border">
              <DayPicker mode="single" selected={selectedDate || undefined} onSelect={(date) => { setSelectedDate(date || null); setSelectedTime(null); }} disabled={disabledDates} />
            </div>
            {selectedDate && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableSlots.map((slot) => (
                  <button key={slot.key} onClick={() => setSelectedTime(slot.key)} className={`border rounded-lg p-4 font-medium transition-all ${selectedTime === slot.key ? 'bg-[#c9a961] text-white shadow-md' : 'bg-white hover:bg-gray-50'}`}>{slot.start} - {slot.end}</button>
                ))}
              </div>
            )}
            <div className="flex justify-center"><button onClick={() => setStep('contact')} disabled={!selectedDate || !selectedTime} className={`px-12 py-4 rounded-sm font-medium transition-all uppercase text-sm ${selectedDate && selectedTime ? 'bg-[#c9a961] text-white' : 'bg-[#e8e8e8] text-[#b0b0b0]'}`}>המשך</button></div>
          </div>
        ) : step === 'contact' ? (
          <div className="space-y-8">
            <button onClick={handleBack} className="text-[#666666] flex items-center gap-2">← חזרה</button>
            <div className="space-y-4 bg-white p-6 rounded-lg border">
              <h2 className="text-xl font-medium text-[#2c2c2c]">פרטי יצירת קשר</h2>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם מלא" className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 outline-none focus:border-[#c9a961]" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="מספר טלפון" className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 outline-none focus:border-[#c9a961]" dir="ltr" />
              <button onClick={handleWhatsAppBooking} disabled={!isFormValid || savingBooking} className={`w-full py-4 rounded-sm font-medium uppercase text-sm ${isFormValid ? 'bg-[#c9a961] text-white' : 'bg-[#e8e8e8] text-[#b0b0b0]'}`}>{savingBooking ? 'שומר...' : 'אישור וקביעת תור ב-SMS'}</button>
            </div>
          </div>
        ) : step === 'verification' ? (
          <div className="flex flex-col items-center py-10 space-y-6">
            <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center text-white text-3xl shadow-lg">🔑</div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#2c2c2c]">הזן קוד אימות</h2>
            <p className="text-[#666666]">שלחנו קוד למספר {customerPhone}</p>
            <input type="text" maxLength={4} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full max-w-[200px] border-b-4 border-[#c9a961] text-center text-4xl font-bold outline-none" dir="ltr" />
            <button onClick={handleVerification} disabled={verifying || verificationCode.length !== 4} className="w-full max-w-sm py-4 bg-[#c9a961] text-white rounded-xl font-bold shadow-lg">אמת תור</button>
          </div>
        ) : step === 'success' ? (
          <div className="text-center py-20 space-y-6 bg-green-50 rounded-2xl border border-green-100">
            <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center mx-auto text-white text-3xl shadow-lg">✓</div>
            <h2 className="text-3xl font-bold text-[#2c2c2c]">התור נקבע בהצלחה!</h2>
            <p className="text-green-700 px-4">תודה שקבעת תור! שלחנו לך SMS עם הפרטים וקישור לאינסטגרם.</p>
            <button onClick={() => window.location.reload()} className="px-10 py-4 bg-[#c9a961] text-white rounded-xl font-bold shadow-md">קבע תור נוסף</button>
          </div>
        ) : null}
      </main>

      {/* Footer עם לינק סודי לניהול */}
      <footer className="w-full py-8 border-t border-[#f0f0f0] mt-12 flex justify-center items-center">
        <a 
          href="/admin" 
          className="text-[#cccccc] text-xs hover:text-[#c9a961] transition-colors duration-300"
        >
          © 2026 Adar Cosmetics
        </a>
      </footer>

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
                <div className="space-y-4 text-center">
                  <p className="font-medium text-[#2c2c2c]">אימות נדרש</p>
                  <p className="text-sm text-[#666666]">נשלח קוד למספר {appointmentsPhone}</p>
                  <input type="text" maxLength={4} value={appointmentsVerificationCode} onChange={(e) => setAppointmentsVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full border rounded-lg px-4 py-3 text-center text-2xl outline-none" dir="ltr" />
                  <button onClick={() => handleAppointmentsVerification()} className="w-full py-3 bg-[#c9a961] text-white rounded-lg font-medium">אמת</button>
                </div>
              ) : !appointmentsVerified ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#2c2c2c]">מספר טלפון</label>
                  <div className="flex gap-2">
                    <input type="tel" value={appointmentsPhone} onChange={(e) => setAppointmentsPhone(e.target.value)} placeholder="0501234567" className="flex-1 border border-[#e0e0e0] rounded-lg px-4 py-3 outline-none" dir="ltr" />
                    <button onClick={() => handleSearchAppointments()} className="px-6 py-3 bg-[#c9a961] text-white rounded-lg font-medium">חפש</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {myAppointments.map((app) => (
                    <div key={app.id} className="border rounded-lg p-4">
                      <div className="text-sm space-y-1 mb-3">
                        <div className="flex justify-between"><span>שירות:</span><span className="font-medium">{app.service_title}</span></div>
                        <div className="flex justify-between"><span>תאריך:</span><span className="font-medium">{formatDateString(app.date)}</span></div>
                        <div className="flex justify-between"><span>שעה:</span><span className="font-medium">{app.start_time}</span></div>
                      </div>
                      <button onClick={() => handleCancelAppointment(app.id!)} className="w-full py-2 bg-red-600 text-white rounded-lg text-xs">ביטול תור</button>
                    </div>
                  ))}
                  <button onClick={() => { clearAllSessions(); setAppointmentsVerified(false); }} className="w-full text-xs text-[#c9a961] underline">החלף מספר טלפון</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}