'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { SiWaze } from 'react-icons/si';
import { Instagram, Phone, Calendar, Check, X, Lock, Sparkles, ChevronLeft, RotateCcw, History, Shield, Eye } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { supabase, Booking, BlockedDate, BlockedTimeSlot, DailySchedule } from '@/lib/supabase';
import { isPhoneVerified, createVerifiedSession, clearAllSessions, getAllVerifiedPhones } from '@/lib/session';

type Step = 'services' | 'calendar' | 'contact' | 'verification' | 'success';

function OTPInput({ value, onChange, error }: { value: string, onChange: (val: string) => void, error?: string }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  
  const digits = useMemo(() => {
    const arr = value.split('').slice(0, 4);
    while (arr.length < 4) arr.push('');
    return arr;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    onChange(newDigits.join(''));
    if (val && index < 3) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3" dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digits[i]}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`w-12 h-14 md:w-14 md:h-16 bg-white border ${error ? 'border-red-300' : 'border-slate-100'} rounded-2xl text-center text-2xl font-light shadow-sm focus:ring-1 focus:ring-[#c9a961] outline-none transition-all`}
          />
        ))}
      </div>
      {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">{error}</p>}
    </div>
  );
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
  
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [temporaryBookingData, setTemporaryBookingData] = useState<any | null>(null); 
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string>('');
  
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [appointmentsPhone, setAppointmentsPhone] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Booking[]>([]);
  const [showHistory, setShowHistory] = useState(false); 
  const [appointmentsVerified, setAppointmentsVerified] = useState(false);
  const [appointmentsVerificationCode, setAppointmentsVerificationCode] = useState<string>('');
  const [appointmentsVerificationError, setAppointmentsVerificationError] = useState<string>('');
  const [appointmentsNeedsVerification, setAppointmentsNeedsVerification] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsBookingId, setAppointmentsBookingId] = useState<string | null>(null); 
  const [appointmentsError, setAppointmentsError] = useState<string>(''); 
  
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);
  const [services, setServices] = useState<any[]>([]);
  
  const [dbMaxCalendarDate, setDbMaxCalendarDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setServices(data);
    };
    fetchServices();
  }, []);

  const selectedServiceData = useMemo(() => {
    const found = services.find(s => s.id === selectedService);
    if (!found) return null;
    return {
      id: found.id,
      title: found.title,
      price: found.price,
      duration: found.duration,
      durationMinutes: found.duration_minutes
    };
  }, [services, selectedService]);

  const isValidPhoneNumber = (phone: string): boolean => { 
    const digits = phone.replace(/\D/g, ''); 
    return digits.length >= 9 && digits.length <= 10 && /^05/.test(digits); 
  };
  const isFormValid = customerName.trim().length > 0 && isValidPhoneNumber(customerPhone);

  const isBookingPast = (bookingDate: string, startTime: string) => {
    const now = new Date();
    const bookingDateTime = new Date(`${bookingDate}T${startTime}`);
    return now >= bookingDateTime;
  };

  const splitAppointments = useMemo(() => {
    const future: Booking[] = [];
    const past: Booking[] = [];
    
    myAppointments.forEach(app => {
      if (isBookingPast(app.date, app.start_time)) {
        past.push(app);
      } else {
        future.push(app);
      }
    });

    return {
      future: future.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)),
      past: past.sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time))
    };
  }, [myAppointments]);

  const sendPendingNotificationToManager = async (booking: any) => {
    const [year, month, day] = booking.date.split('-').map(Number);
    const formattedDate = `${day}/${month}`;
    const formattedTime = booking.start_time.slice(0, 5);
    const managerMessage = `אדר, ממתינה בקשת תור חדשה לאישור שלך!\nלקוחה: ${booking.customer_name}\nטיפול: ${booking.service_title}\nזמן: ${formattedDate} בשעה ${formattedTime}\nטלפון: ${booking.customer_phone}\n\nהכנסי לאפליקציית הניהול לאשר או לדחות.`;
    try {
      await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0508917748', message: managerMessage, isDirectMessage: true })});
    } catch (error) { console.error('Notification error:', error); }
  };

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    const { data: bd } = await supabase.from('blocked_dates').select('*');
    setBlockedDates(bd || []);

    const { data: ds } = await supabase.from('daily_schedules').select('*').eq('date', '2035-12-31').maybeSingle();
    if (ds && ds.start_time) {
      setDbMaxCalendarDate(ds.start_time);
    }
  };

  useEffect(() => {
    if (showMyAppointments) {
      const verifiedPhones = getAllVerifiedPhones();
      if (verifiedPhones.length > 0) {
        setAppointmentsPhone(verifiedPhones[0]);
        fetchMyAppointments(verifiedPhones[0], true);
      }
    }
  }, [showMyAppointments]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const fetchDayData = async () => {
        setLoadingBookings(true);
        const { data: b } = await supabase.from('bookings').select('*').eq('date', dateStr).in('status', ['confirmed', 'pending']);
        const { data: bt } = await supabase.from('blocked_time_slots').select('*').eq('date', dateStr);
        const { data: ds = null } = await supabase.from('daily_schedules').select('*').eq('date', dateStr).maybeSingle();
        setBookings(b || []); setBlockedTimeSlots(bt || []); setDailySchedule(ds);
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
    
    let maxDate = new Date();
    if (dbMaxCalendarDate) {
      const [y, m, d] = dbMaxCalendarDate.split('-').map(Number);
      maxDate = new Date(y, m - 1, d);
      maxDate.setHours(23, 59, 59, 999);
    } else {
      maxDate.setMonth(maxDate.getMonth() + 2);
    }

    const blockedDateObjects = blockedDates.map(bd => parseDateString(bd.date));
    return [{ before: today }, { after: maxDate }, { dayOfWeek: [6] }, ...blockedDateObjects];
  }, [blockedDates, dbMaxCalendarDate]);

  const availableSlots = useMemo(() => {
    if (!selectedServiceData || !selectedDate) return [];
    const timeToMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
    const formatTime = (minutes: number) => { const h = Math.floor(minutes / 60); const m = minutes % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; };
    const dayOfWeek = selectedDate.getDay();
    let workingStartMinutes = 9 * 60;
    let workingEndMinutes = dayOfWeek === 5 ? 12 * 60 : 16 * 60;
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
    if (!selectedServiceData || !selectedDate || !selectedTime || !customerName || !isFormValid || savingBooking) return;
    setSavingBooking(true);
    try {
      const phoneDigits = customerPhone.replace(/\D/g, '');
      const hasActiveSession = isPhoneVerified(phoneDigits);
      
      const slot = availableSlots.find(s => s.key === selectedTime);
      if (!slot) {
        alert('השעה שנבחרה כבר אינה זמינה, אנא בחרי שעה אחרת.');
        setSavingBooking(false);
        return;
      }

      const newBooking = { 
        service_id: selectedServiceData.id, 
        service_title: selectedServiceData.title, 
        service_duration: selectedServiceData.durationMinutes, 
        date: format(selectedDate, 'yyyy-MM-dd'), 
        start_time: slot.start, 
        end_time: slot.end, 
        customer_name: customerName.trim(), 
        customer_phone: phoneDigits, 
        cancellation_token: uuidv4(), 
        status: 'pending', 
        is_verified: hasActiveSession, 
        verification_code: ''
      };

      if (hasActiveSession) {
        const { data, error } = await supabase.from('bookings').insert([newBooking]).select().single();
        if (error) throw error;
        if (data) {
          await sendPendingNotificationToManager(data);
          setStep('success'); 
        }
      } else { 
        const vCode = Math.floor(1000 + Math.random() * 9000).toString();
        newBooking.verification_code = vCode;

        await fetch('/api/sms', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ phone: phoneDigits, code: vCode, customerName: customerName.trim() })
        });

        setTemporaryBookingData(newBooking); 
        setStep('verification'); 
        setVerificationCode(''); 
        setVerificationError('');
      }
    } catch (e) { 
      console.error(e);
      alert('שגיאה ברישום התור. אנא נסי שנית.'); 
    } finally { 
      setSavingBooking(false); 
    }
  };

  const handleVerification = async () => {
    if (!temporaryBookingData || verificationCode.length !== 4 || verifying) return;
    setVerifying(true);
    setVerificationError('');
    
    try {
      if (verificationCode === temporaryBookingData.verification_code) {
        const finalBooking = {
          ...temporaryBookingData,
          is_verified: true,
          verification_code: undefined 
        };

        const { data, error } = await supabase.from('bookings').insert([finalBooking]).select().single();
        if (error) throw error;

        createVerifiedSession(finalBooking.customer_phone); 
        if (data) await sendPendingNotificationToManager(data); 
        
        setTemporaryBookingData(null); 
        setStep('success');
      } else {
        setVerificationError('קוד אימות שגוי');
      }
    } catch (err) {
      console.error(err);
      setVerificationError('שגיאה בשמירת התור, אנא נסי שנית');
    } finally { 
      setVerifying(false); 
    }
  };

  const fetchMyAppointments = async (phone: string, skipVerification = false) => {
    const phoneDigits = phone.replace(/\D/g, '');
    setAppointmentsLoading(true);
    setAppointmentsError('');

    const { data: existing } = await supabase.from('bookings')
      .select('*')
      .eq('customer_phone', phoneDigits)
      .neq('service_id', 'verification')
      .in('status', ['confirmed', 'pending']);

    if (!existing || existing.length === 0) {
      setAppointmentsError('לא נמצאו תורים רשומים עבור מספר טלפון זה.');
      clearAllSessions(); 
      setAppointmentsVerified(false);
      setAppointmentsLoading(false);
      return; 
    }

    if (!skipVerification && !isPhoneVerified(phoneDigits)) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('bookings').update({ verification_code: code }).eq('id', existing[0].id);
      setAppointmentsBookingId(existing[0].id);

      await fetch('/api/sms', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ phone: phoneDigits, code, customerName: existing[0].customer_name || 'לקוחה' })
      });

      setAppointmentsNeedsVerification(true);
      setAppointmentsLoading(false);
      return;
    }
    
    setMyAppointments(existing || []);
    setAppointmentsVerified(true);
    setAppointmentsLoading(false);
  };

  const handleAppointmentsVerification = async () => {
    const phoneDigits = appointmentsPhone.replace(/\D/g, '');
    if (!appointmentsBookingId) return;

    const res = await fetch('/api/verify', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ phone: phoneDigits, code: appointmentsVerificationCode, bookingId: appointmentsBookingId })
    });
    const result = await res.json();
    if (result.verified) {
      createVerifiedSession(phoneDigits);
      await fetchMyAppointments(phoneDigits, true);
      setAppointmentsVerified(true);
      setAppointmentsNeedsVerification(false);
    } else {
      setAppointmentsVerificationError('קוד שגוי');
    }
  };

  const handleCancelAppointment = async (id: string) => {
    const appToCancel = myAppointments.find(a => a.id === id);
    if (!appToCancel) return;

    if (isBookingPast(appToCancel.date, appToCancel.start_time)) {
      alert('לא ניתן לבטל תור שזמנו כבר הגיע או עבר.');
      return;
    }

    if (!confirm('לבטל את התור?')) return;
    const { error = null } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      const [y, m, d] = appToCancel.date.split('-').map(Number);
      const formattedDate = `${d}.${m}`;
      const managerCancelMessage = `אדר, לקוחה ביטלה תור:\nשם: ${appToCancel.customer_name}\nזמן: ${formattedDate} בשעה ${appToCancel.start_time}\nטיפול: ${appToCancel.service_title}`;
      try {
        await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0508917748', message: managerCancelMessage, isDirectMessage: true })});
      } catch (err) { console.error('Manager cancellation notify error:', err); }
      setMyAppointments(prev => prev.filter(a => a.id !== id));
    }
  };

  const formatDateString = (dateStr: string): string => { 
    if(!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d}.${m}`;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FCFBFA] font-sans text-slate-900 selection:bg-[#c9a961]/20 overflow-x-hidden text-right">
      <button onClick={() => { setShowMyAppointments(true); setMyAppointments([]); setAppointmentsPhone(''); setAppointmentsVerified(false); setAppointmentsNeedsVerification(false); setAppointmentsVerificationCode(''); setAppointmentsError(''); setShowHistory(false); }} className="fixed top-5 left-5 z-[100] bg-white/80 backdrop-blur-md border border-slate-200 text-slate-800 px-5 py-2.5 rounded-full shadow-sm transition-all text-xs font-semibold flex items-center gap-2 active:scale-95"><Calendar size={14} className="text-[#c9a961]" /> התורים שלי</button>

      <div className="relative w-full h-[40vh] md:h-[50vh] overflow-hidden">
        <Image src="/hero-bg.jpeg" alt="Adar Cosmetics" fill priority className="object-cover brightness-[0.85]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#FCFBFA]" />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4 pt-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl px-10 py-10 md:px-16 md:py-14 mb-6 max-w-md w-full border border-white/50">
            <h1 className="text-4xl md:text-5xl font-serif italic text-slate-900 mb-2 uppercase">ADAR COSMETICS</h1>
            <p className="text-[#c9a961] text-[10px] tracking-[0.4em] uppercase font-bold">Boutique Experience</p>
          </div>
          <div className="flex items-center justify-center gap-6">
            <a href="https://wa.me/972508917748" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center border border-white"><Image src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width={24} height={24} alt="WA" /></a>
            <a href="tel:0508917748" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center border border-white"><Phone size={22} className="text-[#c9a961]" /></a>
            <a href="https://waze.com/ul?q=מור 5, אור עקיבא" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center border border-white"><SiWaze size={22} className="text-[#33CCFF]" /></a>
            <a href="https://www.instagram.com/adar_abergel_cosmetics/" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center border border-white"><Instagram size={22} className="text-[#E1306C]" /></a>
          </div>
        </div>
      </div>
      
      <main className="max-w-2xl mx-auto px-4 mt-6">
        {step === 'services' && (
          <div className="space-y-6 animate-in fade-in duration-1000">
            <div className="grid grid-cols-1 gap-4">
              {services.map((s) => (
                <div key={s.id} onClick={() => setSelectedService(s.id)} className={`group cursor-pointer p-7 rounded-[2rem] transition-all border shadow-sm ${selectedService === s.id ? 'border-[#c9a961] bg-[#E5E1D8]' : 'border-slate-100 bg-[#FAF9F6] hover:bg-white'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 text-right">
                      <h3 className="text-lg font-light text-slate-800">{s.title}</h3>
                      <p className="text-[10px] tracking-widest uppercase text-slate-400">{s.duration}</p>
                    </div>
                    <div className="text-left flex flex-col items-end"><span className="text-xl font-light text-slate-900">{s.price}</span><div className={`mt-1 h-[1px] w-5 bg-[#c9a961] ${selectedService === s.id ? 'w-full' : 'group-hover:w-full'}`}></div></div>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <p className="text-center py-12 text-slate-400 font-light text-sm animate-pulse">טוען רשימת טיפולים מעודכנת...</p>
              )}
            </div>
            <div className="flex justify-center pt-8"><button onClick={() => setStep('calendar')} disabled={!selectedService} className={`px-16 py-4 rounded-full font-semibold transition-all shadow-lg text-sm tracking-widest uppercase ${selectedService ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>המשך לבחירת זמן</button></div>
          </div>
        )}

        {step === 'calendar' && (
          <div className="space-y-8 animate-in fade-in duration-500 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-50">
            <button onClick={() => setStep('services')} className="text-slate-400 hover:text-slate-950 flex items-center gap-2 font-medium text-xs uppercase tracking-widest">← חזרה</button>
            <div className="flex justify-center p-2"><DayPicker mode="single" selected={selectedDate || undefined} onSelect={(date) => { setSelectedDate(date || null); setSelectedTime(null); }} disabled={disabledDates} /></div>
            {selectedDate && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableSlots.map((slot) => (
                  <button key={slot.key} onClick={() => setSelectedTime(slot.key)} className={`py-4 rounded-2xl text-sm font-medium transition-all border ${selectedTime === slot.key ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-[#FAF9F6] border-transparent text-slate-600 hover:border-[#c9a961]/20'}`}>{slot.start}</button>
                ))}
              </div>
            )}
            <div className="flex justify-center pt-4"><button onClick={() => setStep('contact')} disabled={!selectedDate || !selectedTime} className={`px-16 py-4 rounded-full font-bold transition-all shadow-xl ${selectedDate && selectedTime ? 'bg-[#c9a961] text-white' : 'bg-slate-100 text-slate-300'}`}>המשך</button></div>
          </div>
        )}

        {step === 'contact' && (
          <div className="space-y-8 animate-in fade-in duration-500 bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-50">
            <button onClick={() => setStep('calendar')} className="text-slate-400 hover:text-slate-950 flex items-center gap-2 font-medium text-xs uppercase tracking-widest">← חזרה</button>
            <div className="space-y-6 text-center">
              <h2 className="text-3xl font-serif italic text-slate-900">פרטי יצירת קשר</h2>
              <div className="space-y-4">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="שם מלא" className="w-full bg-[#FAF9F6] border-none rounded-2xl px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] text-center text-lg font-light" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="מספר טלפון" className="w-full bg-[#FAF9F6] border-none rounded-2xl px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] text-center text-lg font-light" dir="ltr" />
              </div>
              <button onClick={handleWhatsAppBooking} disabled={!isFormValid || savingBooking} className={`w-full py-5 rounded-full font-bold text-sm tracking-[0.2em] uppercase shadow-2xl transition-all ${isFormValid ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>{savingBooking ? 'מעבד...' : 'בקשת תור ב-SMS'}</button>
            </div>
          </div>
        )}

        {step === 'verification' && (
          <div className="flex flex-col items-center py-20 space-y-10 animate-in fade-in bg-white rounded-[3rem] p-10 shadow-xl border border-slate-50">
            <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-6"><Lock size={28} /></div>
            <div className="text-center">
              <h2 className="text-3xl font-serif italic mb-2">אימות טלפון</h2>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">הזיני את הקוד שנשלח אלייך</p>
            </div>
            <OTPInput value={verificationCode} onChange={setVerificationCode} error={verificationError} />
            <button onClick={handleVerification} disabled={verifying || verificationCode.length !== 4} className="w-full max-w-xs py-5 bg-slate-900 text-white rounded-full font-bold shadow-2xl uppercase tracking-widest text-[10px] active:scale-95 transition-all">שלחי בקשת תור</button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-24 px-8 space-y-8 bg-white rounded-[4rem] border border-slate-50 shadow-2xl animate-in zoom-in">
            <div className="w-20 h-20 bg-amber-500 rounded-full flex items-center justify-center mx-auto text-white shadow-2xl animate-bounce"><Check size={36} /></div>
            <h2 className="text-4xl font-serif italic text-slate-900">הבקשה נשלחה!</h2>
            <p className="text-slate-500 max-w-sm mx-auto leading-relaxed text-sm">
              התור שלך שוריין במערכת וממתין כעת לאישור הסופי של אדר. <br />
              ברגע שהתור יאושר , תקבלי הודעת SMS למכשירך עם פרטי התור המלאים ! ❤️
            </p>
            <button onClick={() => window.location.reload()} className="px-16 py-5 bg-slate-950 text-white rounded-full font-bold shadow-2xl uppercase tracking-widest text-xs">סגור</button>
          </div>
        )}
      </main>

      {showMyAppointments && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowMyAppointments(false)}>
          <div className="bg-[#FCFBFA] rounded-[3.5rem] shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white px-10 py-8 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-2xl font-serif italic">{showHistory ? 'היסטוריית הטיפולים שלי' : 'התורים העתידיים שלי'}</h2>
              <button onClick={() => setShowMyAppointments(false)} className="bg-slate-50 p-2.5 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            
            {appointmentsVerified && !appointmentsNeedsVerification && (
              <div className="bg-white px-10 py-3 flex gap-3 border-b border-slate-100">
                <button onClick={() => setShowHistory(false)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${!showHistory ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-400'}`}>תורים קרובים</button>
                <button onClick={() => setShowHistory(true)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${showHistory ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-400'}`}>היסטוריית טיפולים</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-10">
              {appointmentsNeedsVerification ? (
                <div className="space-y-10 text-center">
                  <div className="space-y-2">
                    <p className="text-[10px] tracking-[0.2em] text-[#c9a961] uppercase font-bold">Security Check</p>
                    <p className="text-sm text-slate-500">נשלח קוד למספר {appointmentsPhone}</p>
                  </div>
                  <OTPInput value={appointmentsVerificationCode} onChange={setAppointmentsVerificationCode} error={appointmentsVerificationError} />
                  <button onClick={handleAppointmentsVerification} className="w-full py-5 bg-slate-900 text-white rounded-full font-bold shadow-xl text-[10px] tracking-widest uppercase active:scale-95 transition-all">אמת וצפה בתורים</button>
                </div>
              ) : !appointmentsVerified ? (
                <div className="space-y-8 text-center">
                  <p className="text-slate-400 text-sm">הזיני מספר טלפון כדי לצפות בתורים שלך</p>
                  {appointmentsError && (
                    <p className="text-red-500 text-[11px] font-bold uppercase tracking-wider animate-in fade-in bg-red-50/50 border border-red-100 rounded-xl py-2 px-4 max-w-xs mx-auto">
                      {appointmentsError}
                    </p>
                  )}
                  <input type="tel" value={appointmentsPhone} onChange={(e) => { setAppointmentsPhone(e.target.value); if(appointmentsError) setAppointmentsError(''); }} placeholder="050-0000000" className="w-full bg-white border border-slate-100 rounded-[2rem] px-8 py-5 outline-none focus:ring-1 focus:ring-[#c9a961] text-center text-xl font-light shadow-sm" dir="ltr" />
                  <button onClick={() => fetchMyAppointments(appointmentsPhone)} disabled={appointmentsLoading} className="w-full py-5 bg-slate-900 text-white rounded-full font-bold shadow-2xl text-xs tracking-widest uppercase active:scale-95">{appointmentsLoading ? 'שולח קוד...' : 'חפש תורים'}</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {!showHistory ? (
                    splitAppointments.future.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-3 opacity-30">
                        <Calendar size={32} className="text-slate-400" />
                        <p className="italic text-sm">אין לך תורים עתידיים כרגע</p>
                      </div>
                    ) : (
                      splitAppointments.future.map((app) => (
                        <div key={app.id} className="bg-white rounded-[2rem] p-8 border border-slate-50 shadow-sm transition-all hover:shadow-md text-right animate-in fade-in">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-slate-800 text-lg leading-none">{app.service_title}</h4>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                              app.status === 'pending' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200/50 animate-pulse' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                            }`}>
                              {app.status === 'pending' ? 'ממתין לאישור של אדר' : 'מאושר - נתראה! ❤️'}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mb-6">{formatDateString(app.date)} בשעה {app.start_time}</p>
                          <button onClick={() => handleCancelAppointment(app.id!)} className="text-red-400 font-bold text-[9px] uppercase tracking-[0.2em] hover:text-red-600 transition-colors underline underline-offset-8">ביטול תור</button>
                        </div>
                      ))
                    )
                  ) : (
                    splitAppointments.past.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-3 opacity-30">
                        <History size={32} className="text-slate-400" />
                        <p className="italic text-sm">אין עדיין טיפולים קודמים מתועדים במערכת</p>
                      </div>
                    ) : (
                      splitAppointments.past.map((app) => (
                        <div key={app.id} className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100 text-right animate-in fade-in opacity-85">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-slate-700 text-base leading-none">{app.service_title}</h4>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 border border-slate-200/60 px-3 py-1 rounded-xl">בוצע</span>
                          </div>
                          <p className="text-slate-400 text-xs">{formatDateString(app.date)} • בשעה {app.start_time}</p>
                        </div>
                      ))
                    )
                  )}
                  
                  <button onClick={() => { clearAllSessions(); setAppointmentsVerified(false); }} className="w-full text-[9px] text-slate-300 tracking-[0.3em] uppercase mt-10 font-bold hover:text-slate-500 transition-colors flex items-center justify-center gap-2"><RotateCcw size={10} /> Log out / Change Number</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="w-full py-12 text-center text-[10px] font-bold tracking-[0.1em] text-slate-400 flex items-center justify-center gap-3 md:gap-4 relative z-30 font-sans select-none">
        <button onClick={() => setShowAccessibilityModal(true)} className="hover:text-[#c9a961] active:text-[#c9a961] transition-colors cursor-pointer text-slate-400/80">הצהרת נגישות</button>
        <span className="text-slate-200/50">•</span>
        <span className="text-[9px] tracking-[0.4em] uppercase text-slate-300 font-light">© 2026 Adar Cosmetics</span>
        <span className="text-slate-200/50">•</span>
        <button onClick={() => setShowPrivacyModal(true)} className="hover:text-[#c9a961] active:text-[#c9a961] transition-colors cursor-pointer text-slate-400/80">מדיניות פרטיות</button>
      </footer>
    </div>
  );
}