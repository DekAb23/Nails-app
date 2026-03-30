'use client';

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { SiWaze } from 'react-icons/si';
import { Instagram, Phone, Calendar, Check, X, Lock, Sparkles, ChevronLeft } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { supabase, Booking, BlockedDate, BlockedTimeSlot, DailySchedule, logActivity } from '@/lib/supabase';
import { isPhoneVerified, createVerifiedSession, clearAllSessions, getAllVerifiedPhones } from '@/lib/session';

type Step = 'services' | 'calendar' | 'contact' | 'verification' | 'success';

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
  
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string>('');
  
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [appointmentsPhone, setAppointmentsPhone] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Booking[]>([]);
  const [appointmentsVerified, setAppointmentsVerified] = useState(false);
  const [appointmentsVerificationCode, setAppointmentsVerificationCode] = useState<string>('');
  const [appointmentsVerificationError, setAppointmentsVerificationError] = useState<string>('');
  const [appointmentsNeedsVerification, setAppointmentsNeedsVerification] = useState(false);
  
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);

  const services = [
    { id: 'anatomical-gel', title: "מבנה אנטומי - ג'ל בנייה", price: "150 ₪", duration: "90 דקות", durationMinutes: 90 },
    { id: 'anatomical-gel-extended', title: "בנייה חדשה בטיפס ג'ל", price: "250 ₪", duration: "150 דקות", durationMinutes: 150 },
    { id: 'gel-pedicure', title: "לק ג'ל רגליים", price: "100 ₪", duration: "40 דקות", durationMinutes: 40 },
    { id: 'eyebrows-mustache', title: "גבות / שפם", price: "60 ₪", duration: "20 דקות", durationMinutes: 20 },
  ];

  const selectedServiceData = services.find(s => s.id === selectedService);

  const isValidPhoneNumber = (phone: string): boolean => { 
    const digits = phone.replace(/\D/g, ''); 
    return digits.length >= 9 && digits.length <= 10 && /^05/.test(digits); 
  };
  const isFormValid = customerName.trim().length > 0 && isValidPhoneNumber(customerPhone);

  const sendConfirmationNotifications = async (booking: any) => {
    const formattedDate = format(parseDateString(booking.date), 'dd/MM');
    const customerMessage = `שלום ${booking.customer_name}, \nנקבע לך תור אצל Adar Cosmetics\n${booking.service_title}\nבתאריך ${formattedDate} בשעה ${booking.start_time}\nבכתובת מור 5 א', קומה 6 דירה 25.\n\nשימי לב- אי הגעה לתור או ביטול בפחות מ24 שעות מותנה בתשלום של 50% מסך הטיפול. \n\nקישור לאינסטגרם:\nhttps://www.instagram.com/adar_abergel_cosmetics?igsh=MWd5aXlyaDV4dHMwZA==`;
    const adarMessage = `אדר, נקבע תור חדש!\nלקוחה: ${booking.customer_name}\nטיפול: ${booking.service_title}\nזמן: ${formattedDate} ב-${booking.start_time}\nטלפון: ${booking.customer_phone}`;

    try {
      await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: booking.customer_phone, message: customerMessage, isDirectMessage: true })});
      await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0508917748', message: adarMessage, isDirectMessage: true })});
    } catch (error) { console.error('Notification error:', error); }
  };

  useEffect(() => { fetchData(); }, []);
  
  const fetchData = async () => {
    const { data: bd } = await supabase.from('blocked_dates').select('*');
    setBlockedDates(bd || []);
  };

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
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const fetchDayData = async () => {
        setLoadingBookings(true);
        const { data: b } = await supabase.from('bookings').select('*').eq('date', dateStr).neq('status', 'cancelled');
        const { data: bt } = await supabase.from('blocked_time_slots').select('*').eq('date', dateStr);
        const { data: ds } = await supabase.from('daily_schedules').select('*').eq('date', dateStr).single();
        setBookings(b || []);
        setBlockedTimeSlots(bt || []);
        setDailySchedule(ds || null);
        setLoadingBookings(false);
      };
      fetchDayData();
    }
  }, [selectedDate]);

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
    const timeToMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const formatTime = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; };
    const dayOfWeek = selectedDate.getDay();
    let workingStartMinutes = 9 * 60;
    let workingEndMinutes = dayOfWeek === 5 ? 12 * 60 : 18 * 60;
    if (dailySchedule) { workingStartMinutes = timeToMinutes(dailySchedule.start_time); workingEndMinutes = timeToMinutes(dailySchedule.end_time); }
    const dateBlockedSlots = blockedTimeSlots.map(bt => ({ start: timeToMinutes(bt.start_time), end: timeToMinutes(bt.end_time) }));
    const duration = selectedServiceData.durationMinutes;
    const slots = [];
    let currentPos = workingStartMinutes;
    while (currentPos + duration <= workingEndMinutes) {
      const slotEnd = currentPos + duration;
      const isTaken = bookings.some(b => currentPos < timeToMinutes(b.end_time) && slotEnd > timeToMinutes(b.start_time));
      const isBlocked = dateBlockedSlots.some(b => currentPos < b.end && slotEnd > b.start);
      if (!isTaken && !isBlocked) slots.push({ start: formatTime(currentPos), end: formatTime(slotEnd), key: formatTime(currentPos) });
      currentPos += 30;
    }
    const today = new Date();
    if (format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      const nowMins = today.getHours() * 60 + today.getMinutes();
      return slots.filter(s => timeToMinutes(s.start) > nowMins);
    }
    return slots;
  }, [selectedServiceData, selectedDate, bookings, blockedTimeSlots, dailySchedule]);

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
      const { data, error } = await supabase.from('bookings').insert([newBooking]).select().single();
      if (error) throw error;
      if (data) {
        if (hasActiveSession) { await sendConfirmationNotifications(data); setStep('success'); }
        else { setCurrentBookingId(data.id); setStep('verification'); }
      }
    } catch (e) {
      alert('שגיאה ברישום התור. אנא וודאו שכל הפרטים נכונים.');
    } finally { setSavingBooking(false); }
  };

  const handleVerification = async () => {
    setVerifying(true);
    const phoneDigits = customerPhone.replace(/\D/g, '');
    try {
      const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: verificationCode, bookingId: currentBookingId })});
      const result = await res.json();
      if (result.verified) {
        createVerifiedSession(phoneDigits);
        const { data } = await supabase.from('bookings').select('*').eq('id', currentBookingId).single();
        if (data) await sendConfirmationNotifications(data);
        setStep('success');
      } else setVerificationError('קוד אימות שגוי');
    } finally { setVerifying(false); }
  };

  const fetchMyAppointments = async (phone: string, skipVerification = false) => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (!skipVerification && !isPhoneVerified(phoneDigits)) {
      setAppointmentsNeedsVerification(true);
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code, customerName: 'לקוח' })});
      return;
    }
    const { data } = await supabase.from('bookings').select('*').eq('customer_phone', phoneDigits).neq('service_id', 'verification_only').in('status', ['confirmed']).order('date');
    setMyAppointments(data || []);
    setAppointmentsVerified(true);
  };

  const handleAppointmentsVerification = async () => {
    const phoneDigits = appointmentsPhone.replace(/\D/g, '');
    const res = await fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phoneDigits, code: appointmentsVerificationCode })});
    const result = await res.json();
    if (result.verified) {
      createVerifiedSession(phoneDigits);
      await fetchMyAppointments(appointmentsPhone, true);
      setAppointmentsNeedsVerification(false);
    } else setAppointmentsVerificationError('קוד שגוי');
  };

  const handleCancelAppointment = async (id: string) => {
    if (!confirm('לבטל את התור?')) return;
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    setMyAppointments(prev => prev.filter(a => a.id !== id));
  };

  const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const formatDateString = (dateStr: string): string => { 
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ב${hebrewMonths[m-1]}`;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FCFBFA] font-sans text-slate-900 selection:bg-[#c9a961]/20 overflow-x-hidden">
      
      {/* כפתור "התורים שלי" */}
      <button
        onClick={() => { setShowMyAppointments(true); setMyAppointments([]); setAppointmentsPhone(''); setAppointmentsVerified(false); setAppointmentsNeedsVerification(false); }}
        className="fixed top-5 left-5 z-[100] bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 px-5 py-2.5 rounded-full shadow-sm transition-all text-xs font-semibold flex items-center gap-2 active:scale-95 hover:shadow-md"
      >
        <Calendar size={14} className="text-[#c9a961]" /> התורים שלי
      </button>

      {/* Hero Section */}
      <div className="relative w-full h-[45vh] md:h-[50vh] overflow-hidden">
        <Image src="/hero-bg.jpeg" alt="Adar Cosmetics" fill priority className="object-cover brightness-[0.85] scale-105" quality={90} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#FCFBFA]" />
        
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4 pt-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl px-10 py-10 md:px-16 md:py-14 mb-6 max-w-md w-full text-center border border-white/50">
            <h1 className="text-4xl md:text-5xl font-serif italic tracking-tighter text-slate-900 mb-2 uppercase">ADAR COSMETICS</h1>
            <p className="text-[#c9a961] text-[10px] tracking-[0.4em] uppercase font-bold">Boutique Experience</p>
          </div>
          
          <div className="flex items-center justify-center gap-6">
            <a href="https://wa.me/972508917748" target="_blank" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-all border border-white">
                <Image src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={24} height={24} alt="WA" />
            </a>
            <a href="tel:0508917748" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-all border border-white">
              <Phone size={22} className="text-[#c9a961]" />
            </a>
            <a href="https://waze.com/ul?q=מור 5, אור עקיבא" target="_blank" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-all border border-white">
              <SiWaze size={22} className="text-[#33CCFF]" />
            </a>
            <a href="https://www.instagram.com/adar_abergel_cosmetics/" target="_blank" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-all border border-white">
              <Instagram size={22} className="text-[#E1306C]" />
            </a>
          </div>
        </div>
      </div>
      
      <main className="w-full max-w-2xl mx-auto px-6 pt-10 relative z-20 pb-20">
        {step === 'services' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <div className="grid grid-cols-1 gap-4">
              {services.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => setSelectedService(s.id)} 
                  className={`group cursor-pointer p-7 rounded-[2rem] transition-all duration-500 border relative overflow-hidden shadow-sm ${
                    selectedService === s.id 
                    ? 'border-[#c9a961] bg-[#E5E1D8] scale-[1.01]' 
                    : 'border-slate-100 bg-[#FAF9F6] hover:bg-white hover:border-[#c9a961]/20'
                  }`}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-light tracking-tight text-slate-800">{s.title}</h3>
                      <p className="text-[10px] tracking-widest uppercase text-slate-400 font-medium">{s.duration}</p>
                    </div>
                    <div className="text-left flex flex-col items-end">
                      <span className="text-xl font-light text-slate-900">{s.price}</span>
                      <div className={`mt-1 h-[1px] w-5 transition-all duration-500 bg-[#c9a961] ${selectedService === s.id ? 'w-full' : 'group-hover:w-full'}`}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-8">
              <button 
                onClick={() => setStep('calendar')} 
                disabled={!selectedService} 
                className={`px-16 py-4 rounded-full font-semibold transition-all shadow-lg active:scale-95 text-sm tracking-widest uppercase ${
                  selectedService ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'
                }`}
              >
                המשך לבחירת זמן
              </button>
            </div>
          </div>
        )}

        {step === 'calendar' && (
          <div className="space-y-8 animate-in fade-in duration-500 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
            <button onClick={() => setStep('services')} className="text-slate-400 hover:text-slate-950 flex items-center gap-2 font-medium transition-colors text-xs uppercase tracking-widest">← חזרה</button>
            <div className="flex justify-center p-2">
              <DayPicker mode="single" selected={selectedDate || undefined} onSelect={(date) => { setSelectedDate(date || null); setSelectedTime(null); }} disabled={disabledDates} />
            </div>
            {selectedDate && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableSlots.map((slot) => (
                  <button key={slot.key} onClick={() => setSelectedTime(slot.key)} className={`py-4 rounded-2xl text-sm font-medium transition-all border ${selectedTime === slot.key ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-[#FAF9F6] border-transparent text-slate-600 hover:border-[#c9a961]/20'}`}>{slot.start}</button>
                ))}
              </div>
            )}
            <div className="flex justify-center pt-4">
              <button onClick={() => setStep('contact')} disabled={!selectedDate || !selectedTime} className={`px-16 py-4 rounded-full font-bold transition-all shadow-xl ${selectedDate && selectedTime ? 'bg-[#c9a961] text-white' : 'bg-slate-100 text-slate-300'}`}>המשך</button>
            </div>
          </div>
        )}

        {step === 'contact' && (
          <div className="space-y-8 animate-in fade-in duration-500 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50">
            <button onClick={() => setStep('calendar')} className="text-slate-400 hover:text-slate-950 flex items-center gap-2 font-medium text-xs uppercase tracking-widest">← חזרה</button>
            <div className="space-y-6 text-center">
              <h2 className="text-3xl font-serif italic text-slate-900">פרטי יצירת קשר</h2>
              <div className="space-y-4">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם מלא" className="w-full bg-[#FAF9F6] border-none rounded-2xl px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] transition-all text-center text-lg font-light" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="מספר טלפון" className="w-full bg-[#FAF9F6] border-none rounded-2xl px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] transition-all text-center text-lg font-light" dir="ltr" />
              </div>
              <button onClick={handleWhatsAppBooking} disabled={!isFormValid || savingBooking} className={`w-full py-5 rounded-full font-bold text-sm tracking-[0.2em] uppercase shadow-2xl transition-all ${isFormValid ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>{savingBooking ? 'מעבד...' : 'אישור וקביעת תור ב-SMS'}</button>
            </div>
          </div>
        )}

        {step === 'verification' && (
          <div className="flex flex-col items-center py-20 space-y-10 animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl rotate-6"><Lock size={32} /></div>
            <h2 className="text-4xl font-serif italic mb-4 text-slate-900">קוד אימות</h2>
            <input type="text" maxLength={4} value={verificationCode} onChange={(e) => { setVerificationCode(e.target.value.replace(/\D/g, '')); setVerificationError(''); }} className="w-32 border-b-2 border-[#c9a961] py-4 text-center text-5xl font-light tracking-[0.5em] outline-none bg-transparent" dir="ltr" />
            <button onClick={handleVerification} disabled={verifying || verificationCode.length !== 4} className="w-full max-w-sm py-5 bg-slate-900 text-white rounded-full font-bold shadow-2xl uppercase tracking-widest text-xs">אמת תור</button>
            {verificationError && <p className="text-red-500 mt-2">{verificationError}</p>}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-24 px-8 space-y-8 bg-white rounded-[4rem] border border-slate-50 shadow-2xl animate-in zoom-in duration-1000">
            <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center mx-auto text-white shadow-2xl animate-bounce"><Check size={36} /></div>
            <h2 className="text-4xl font-serif italic text-slate-900">נתראה בקרוב!</h2>
            <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-light">תודה שקבעת תור! שלחנו לך SMS עם הפרטים וקישור לאינסטגרם.</p>
            <button onClick={() => window.location.reload()} className="px-16 py-5 bg-slate-950 text-white rounded-full font-bold shadow-2xl uppercase tracking-widest text-xs">סגור</button>
          </div>
        )}
      </main>

      {/* MODAL - "התורים שלי" */}
      {showMyAppointments && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowMyAppointments(false)}>
          <div className="bg-[#FCFBFA] rounded-[3.5rem] shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white px-10 py-10 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-2xl font-serif italic text-slate-900">התורים שלי</h2>
              <button onClick={() => setShowMyAppointments(false)} className="bg-slate-50 p-2.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-10">
              {appointmentsNeedsVerification ? (
                <div className="space-y-8 text-center">
                  <p className="text-xs tracking-[0.2em] text-slate-400 uppercase">Verification Required</p>
                  <p className="text-sm text-[#666666]">נשלח קוד למספר {appointmentsPhone}</p>
                  <input type="text" maxLength={4} value={appointmentsVerificationCode} onChange={(e) => setAppointmentsVerificationCode(e.target.value.replace(/\D/g, ''))} className="w-full border-b-2 border-slate-200 py-6 text-center text-4xl font-light outline-none focus:border-[#c9a961] bg-transparent" dir="ltr" />
                  <button onClick={handleAppointmentsVerification} className="w-full py-5 bg-slate-900 text-white rounded-full font-bold shadow-xl text-xs tracking-widest uppercase">אמת</button>
                </div>
              ) : !appointmentsVerified ? (
                <div className="space-y-8 text-center">
                  <p className="text-slate-400 font-light leading-relaxed text-sm">הזיני מספר טלפון כדי לצפות בתורים שלך</p>
                  <input type="tel" value={appointmentsPhone} onChange={(e) => setAppointmentsPhone(e.target.value)} placeholder="050-0000000" className="w-full bg-white border border-slate-100 rounded-[2rem] px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] text-center text-xl font-light shadow-sm" dir="ltr" />
                  <button onClick={() => fetchMyAppointments(appointmentsPhone)} className="w-full py-5 bg-slate-900 text-white rounded-full font-bold shadow-2xl text-xs tracking-widest uppercase">חפש</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {myAppointments.length === 0 ? <p className="text-center py-10 opacity-30 italic font-light">אין תורים עתידיים</p> : 
                    myAppointments.map((app) => (
                      <div key={app.id} className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm">
                        <h4 className="font-medium text-slate-800 text-lg mb-2">{app.service_title}</h4>
                        <p className="text-slate-400 text-sm mb-6 font-light">{formatDateString(app.date)} ב-{app.start_time}</p>
                        <button onClick={() => handleCancelAppointment(app.id!)} className="text-red-400 font-semibold text-[10px] uppercase tracking-widest hover:text-red-600 transition-colors underline decoration-red-100 underline-offset-8">ביטול תור</button>
                      </div>
                    ))
                  }
                  <button onClick={() => { clearAllSessions(); setAppointmentsVerified(false); }} className="w-full text-[10px] text-slate-300 tracking-widest uppercase mt-6 font-medium">Log out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="w-full py-16 text-center opacity-30"><a href="/admin" className="text-[9px] font-bold tracking-[0.8em] uppercase hover:text-[#c9a961]">© 2026 Adar Cosmetics</a></footer>
    </div>
  );
}