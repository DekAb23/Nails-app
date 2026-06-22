'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone,
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X, Activity, Lock, ChevronRight, ChevronLeft, Hand, Star, Heart, Search, Sparkles, Edit3, Plus, Bell, CheckCircle2
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // וידוא שימוש ב-uuid ליצירת מזהים אוטומטיים

// --- Type definitions ---
type BlockedTimeSlot = {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
};

type CustomerStats = {
  phone: string;
  name: string;
  totalBookings: number;
  firstVisit: string;
  lastVisit: string;
  favoriteService: string;
};

// --- פונקציות עזר ---
const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

function StatCard({ title, value, icon: Icon, color }: any) {
  const colorStyles: any = {
    'blue': 'bg-blue-500/5 text-blue-600 border-blue-500/10',
    'gold': 'bg-[#c9a961]/5 text-[#b8964f] border-[#c9a961]/10',
    'red': 'bg-red-500/5 text-red-600 border-red-500/10',
  };

  return (
    <div className={`backdrop-blur-2xl bg-white/60 border ${colorStyles[color]?.split(' ')[2] || 'border-slate-100'} p-3 md:p-4 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center w-full`}>
      <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">{title}</p>
      <div className="flex items-center gap-2">
        <Icon size={14} className={colorStyles[color]?.split(' ')[1] || 'text-slate-600'} />
        <h3 className="text-lg md:text-2xl font-light text-slate-900 tabular-nums leading-none">{value}</h3>
      </div>
    </div>
  );
}

function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError('פרטים שגויים'); return; }
      if (data.session) onLoginSuccess();
    } catch (err) { setError('שגיאה'); } finally { setLoading(false); }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FDFBF6] px-4 font-sans text-right">
      <div className="bg-white/90 backdrop-blur-3xl rounded-[2.5rem] border border-white p-10 max-w-sm w-full shadow-2xl text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto mb-8 flex items-center justify-center shadow-lg"><Settings2 className="text-white w-8 h-8" /></div>
        <h1 className="text-2xl font-serif italic text-slate-900 mb-8 tracking-tight">כניסת מנהלת</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-center outline-none focus:border-[#c9a961] transition-all text-base" placeholder="אימייל" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-center outline-none focus:border-[#c9a961] transition-all text-base" placeholder="סיסמה" required />
          <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all text-sm tracking-widest uppercase mt-4">התחברי</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar' | 'customers' | 'services' | 'activity' | 'approvals'>('daily');
  const [isQuickCalendarOpen, setIsQuickCalendarOpen] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [dailySchedules, setDailySchedules] = useState<DailySchedule[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  // States לניהול השירותים
  const [dbServices, setDbServices] = useState<any[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({ title: '', price: '', duration: '', duration_minutes: 30 });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customHoursStartTime, setCustomHoursStartTime] = useState<string>('09:00');
  const [customHoursEndTime, setCustomHoursEndTime] = useState<string>('16:00');
  const [breakStartTime, setBreakStartTime] = useState<string>('14:00');
  const [breakEndTime, setBreakEndTime] = useState<string>('16:00');

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const toLocalDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // עדכון דינמי של שדות השעה בעת מעבר ימים כדי לשקף את הקיים במסד הנתונים
  useEffect(() => {
    const dStr = toLocalDateString(selectedDate);
    const existingSchedule = dailySchedules.find(ds => ds.date === dStr);
    if (existingSchedule) {
      setCustomHoursStartTime(existingSchedule.start_time.slice(0, 5));
      setCustomHoursEndTime(existingSchedule.end_time.slice(0, 5));
    } else {
      setCustomHoursStartTime('09:00');
      setCustomHoursEndTime('16:00');
    }
  }, [selectedDate, dailySchedules]);

  const formatHeDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  const fetchData = async () => {
    const { data: b } = await supabase.from('bookings').select('*').neq('status', 'cancelled').order('date');
    const { data: bd } = await supabase.from('blocked_dates').select('*').order('date');
    const { data: ds } = await supabase.from('daily_schedules').select('*').order('date');
    const { data: bts } = await supabase.from('blocked_time_slots').select('*').order('date');
    const { data: al } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: s } = await supabase.from('services').select('*').order('created_at', { ascending: true });
    
    setBookings(b || []); setBlockedDates(bd || []); setDailySchedules(ds || []); setBlockedTimeSlots(bts || []); setActivities(al || []);
    setDbServices(s || []);
  };

  // מנוע חישוב וסינון לקוחות מתוך הדאטה (עם ניקוי שורות אימות)
  const customerBaseStats = useMemo(() => {
    const adminPhone = '0508917748';
    const customerMap: Record<string, { name: string; dates: string[]; services: Record<string, number> }> = {};

    bookings.forEach(b => {
      if (b.customer_phone === adminPhone || b.service_id === 'verification' || b.customer_name === 'לקוחה חדשה') return;

      if (!customerMap[b.customer_phone]) {
        customerMap[b.customer_phone] = {
          name: b.customer_name,
          dates: [],
          services: {}
        };
      }
      
      customerMap[b.customer_phone].dates.push(b.date);
      customerMap[b.customer_phone].services[b.service_title] = (customerMap[b.customer_phone].services[b.service_title] || 0) + 1;
    });

    const allCalculated = Object.entries(customerMap).map(([phone, data]) => {
      const sortedDates = [...data.dates].sort((a, b) => a.localeCompare(b));
      
      let favoriteService = 'לא מוגדר';
      let maxCount = 0;
      Object.entries(data.services).forEach(([service, count]) => {
        if (count > maxCount) {
          maxCount = count;
          favoriteService = service;
        }
      });

      return {
        phone,
        name: data.name,
        totalBookings: data.dates.length,
        firstVisit: sortedDates[0],
        lastVisit: sortedDates[sortedDates.length - 1],
        favoriteService
      };
    });

    const מתמידות = allCalculated.filter(c => c.totalBookings > 1).sort((a, b) => b.totalBookings - a.totalBookings);
    const חדשות = allCalculated.filter(c => c.totalBookings === 1);

    return {
      allCustomers: allCalculated,
      loyalCustomers: מתמידות,
      newCustomersCount: חדשות.length,
      totalActiveCount: allCalculated.length
    };
  }, [bookings]);

  const loyalCustomers = customerBaseStats.loyalCustomers;

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return loyalCustomers;
    
    const cleanSearch = searchTerm.toLowerCase().trim();
    return loyalCustomers.filter(c =>
      c.name.toLowerCase().includes(cleanSearch) ||
      c.phone.includes(cleanSearch)
    );
  }, [loyalCustomers, searchTerm]);

  // סינון בקשות ממתינות לאישור אדר
  const pendingApprovals = useMemo(() => {
    return bookings.filter(b => b.status === 'pending').sort((a,b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
  }, [bookings]);

  const handleApproveBooking = async (booking: Booking) => {
    try {
      const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);
      if (error) throw error;

      const [year, month, day] = booking.date.split('-').map(Number);
      const formattedDate = `${day}/${month}`;
      const formattedTime = booking.start_time.slice(0, 5);
      
      const customerMessage = `היי ${booking.customer_name},\nהתור שלך אושר בהצלחה! 🎉\n\n${booking.service_title}\nבתאריך ${formattedDate} בשעה ${formattedTime}\nבכתובת מור 5 א', קומה 6 דירה 25.\n\nשימי לב -\nהשלמה/תיקון בתוספת 10 ש"ח לציפורן.\nאי געה לתור או ביטול בפחות מ24 שעות מותנה בתשלום של 50% מסך הטיפול.\n\nנתראה! ❤️`;
      
      try {
        await fetch('/api/sms', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ phone: booking.customer_phone, message: customerMessage, isDirectMessage: true })
        });
      } catch (smsErr) {
        console.error('SMS Send bypassed or failed:', smsErr);
      }

      await supabase.from('activity_log').insert([{
        id: uuidv4(),
        action: `התור של ${booking.customer_name} לתאריך ${formattedDate} אושר על ידי אדר`,
        created_at: new Date().toISOString()
      }]);

      await fetchData();
    } catch (e) {
      alert('שגיאה באישור התור במערכת');
    }
  };

  const handleRejectBooking = async (booking: Booking) => {
    if (!confirm(`האם את בטוחה שברצונך לדחות ולמחוק את בקשת התור של ${booking.customer_name}?`)) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id);
      if (error) throw error;
      await fetchData();
    } catch (e) {
      alert('שגיאה בדחיית התור');
    }
  };

  const handleOpenServiceModal = (service: any = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        title: service.title,
        price: service.price,
        duration: service.duration,
        duration_minutes: service.duration_minutes
      });
    } else {
      setEditingService(null);
      setServiceForm({ title: '', price: '', duration: '', duration_minutes: 30 });
    }
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.title || !serviceForm.price || !serviceForm.duration) {
      alert('אנא מלאי את כל השדות בשירות.');
      return;
    }

    let error = null;
    if (editingService) {
      const payload = {
        title: serviceForm.title.trim(),
        price: serviceForm.price.trim(),
        duration: serviceForm.duration.trim(),
        duration_minutes: Number(serviceForm.duration_minutes)
      };
      const { error: err } = await supabase.from('services').update(payload).eq('id', editingService.id);
      error = err;
    } else {
      const payload = {
        id: uuidv4(),
        title: serviceForm.title.trim(),
        price: serviceForm.price.trim(),
        duration: serviceForm.duration.trim(),
        duration_minutes: Number(serviceForm.duration_minutes)
      };
      const { error: err } = await supabase.from('services').insert([payload]);
      error = err;
    }

    if (error) {
      alert('שגיאה בשמירת השירות.');
    } else {
      setIsServiceModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('האם את בטוחה שברצונך למחוק שירות זה? לקוחות לא יוכלו להזמין אותו יותר.')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) alert('לא ניתן למחוק את השירות.');
    else fetchData();
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session); setCheckingAuth(false);
    };
    checkAuth();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const changeDay = (offset: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + offset);
    setSelectedDate(newDate);
  };

  const bookingDateObjects = useMemo(() => bookings.filter(b => b.status === 'confirmed').map(b => {
    const [y, m, d] = b.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }), [bookings]);

  const blockedDateObjects = useMemo(() => blockedDates.map(bd => {
    const [y, m, d] = bd.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }), [blockedDates]);

  const partialDateObjects = useMemo(() => {
    const daysWithSchedules = dailySchedules.filter(ds => ds.start_time !== '09:00' || ds.end_time !== '16:00').map(ds => ds.date);
    const daysWithBreaks = blockedTimeSlots.map(bts => bts.date);
    const uniqueDays = Array.from(new Set([...daysWithSchedules, ...daysWithBreaks]));
    return uniqueDays.map(dateStr => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    });
  }, [dailySchedules, blockedTimeSlots]);

  const pastDates = useMemo(() => ({ before: new Date(new Date().setHours(0, 0, 0, 0)) }), []);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 8; h <= 21; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const dailyBookings = useMemo(() => bookings.filter(b => b.date === toLocalDateString(selectedDate) && b.customer_phone !== '0508917748').sort((a,b) => a.start_time.localeCompare(b.start_time)), [bookings, selectedDate]);
  const currentDaySchedule = useMemo(() => dailySchedules.find(ds => ds.date === toLocalDateString(selectedDate)), [dailySchedules, selectedDate]);
  const currentDayBreaks = useMemo(() => blockedTimeSlots.filter(bts => bts.date === toLocalDateString(selectedDate)), [blockedTimeSlots, selectedDate]);
  const isFullBlocked = useMemo(() => blockedDates.some(bd => bd.date === toLocalDateString(selectedDate)), [blockedDates, selectedDate]);
  
  const futureBlockedList = useMemo(() => blockedDates.filter(bd => bd.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [blockedDates, todayStr]);
  const futureSchedulesList = useMemo(() => dailySchedules.filter(ds => ds.date >= todayStr && (ds.start_time !== '09:00' || ds.end_time !== '16:00')).sort((a,b) => a.date.localeCompare(b.date)), [dailySchedules, todayStr]);
  const futureBreaksList = useMemo(() => blockedTimeSlots.filter(bts => bts.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [blockedTimeSlots, todayStr]);

  if (checkingAuth) return null;
  if (!session) return <LoginForm onLoginSuccess={() => fetchData()} />;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF6] text-slate-800 font-sans text-right pb-24 selection:bg-[#c9a961]/10">
      
      {/* עיצוב לוח שנה מקצועי, נקי וללא עיוותי גדלים או היעלמויות טקסט */}
      <style jsx global>{`
        .rdp { --rdp-accent-color: #c9a961; width: 100%; margin: 0; display: flex; justify-content: center; }
        .rdp-day { border-radius: 12px; font-weight: 500; transition: all 0.2s; position: relative; }
        .rdp-day_selected { background: #c9a961 !important; color: #fff !important; font-weight: 900 !important; box-shadow: 0 4px 12px rgba(201,169,97,0.3); }
        
        /* נקודות סימון אסתטיות בתחתית המשבצת למניעת בריחה ומריחה של רקעים */
        .rdp-day_hasBooking::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: #c9a961; border-radius: 50%; }
        .rdp-day_blocked { background: #fee2e2 !important; color: #b91c1c !important; }
        .rdp-day_partial { background: #fefce8 !important; color: #a16207 !important; }
        .rdp-day_past { color: #cbd5e1 !important; pointer-events: auto; }
      `}</style>

      <div className="sticky top-0 z-[100] bg-[#FDFBF6]/95 backdrop-blur-2xl px-4 pt-6 pb-3 border-b border-slate-200/40 shadow-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><Activity size={18} /></div>
            <div>
              <h1 className="text-base font-serif italic text-slate-900 leading-none">Console</h1>
              <p className="text-[10px] text-[#c9a961] font-black uppercase tracking-widest mt-1.5">אדר קוסמטיקס</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('approvals')} 
              className={`w-10 h-10 rounded-xl border flex items-center justify-center relative transition-all ${activeTab === 'approvals' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              <Bell size={16} className={pendingApprovals.length > 0 ? 'animate-bounce' : ''} />
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#FDFBF6]">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
            <button onClick={() => supabase.auth.signOut()} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-3">
          {activeTab === 'customers' ? (
            <>
              <StatCard title="מתמידות" value={customerBaseStats.loyalCustomers.length} icon={Star} color="gold" />
              <StatCard title="מזדמנות" value={customerBaseStats.newCustomersCount} icon={Sparkles} color="blue" />
              <StatCard title="סך הכל לקוחות" value={customerBaseStats.totalActiveCount} icon={Users} color="gold" />
            </>
          ) : activeTab === 'services' ? (
            <>
              <StatCard title="סך הכל טיפולים" value={dbServices.length} icon={Sparkles} color="gold" />
              <StatCard title="זמן קצר ביותר" value={dbServices.length > 0 ? `${Math.min(...dbServices.map(s => s.duration_minutes))} דק'` : '0'} icon={Clock} color="blue" />
              <StatCard title="שירותים באוויר" value={dbServices.length} icon={Activity} color="blue" />
            </>
          ) : (
            <>
              <StatCard title="היום" value={bookings.filter(b => b.date === todayStr && b.status === 'confirmed').length} icon={Clock} color="blue" />
              <StatCard title="בקשות ממתינות" value={pendingApprovals.length} icon={Bell} color={pendingApprovals.length > 0 ? 'red' : 'gold'} />
              <StatCard title="חסימות" value={blockedDates.filter(bd => bd.date >= todayStr).length} icon={XCircle} color="red" />
            </>
          )}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        
        {/* --- לשונית בקשות תורים לאישור --- */}
        {activeTab === 'approvals' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2.5 mb-2 border-b border-slate-100 pb-4">
                <Bell size={18} className="text-amber-500" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">אישור בקשות תורים ממתינות ({pendingApprovals.length})</h2>
              </div>
              <p className="text-[10px] text-slate-400 mb-4">תורים אלו תופסים את השעה ביומן של הלקוחות, אך לא יירשמו ביומן של אדר עד שלא יאושרו סופית.</p>
              
              <div className="space-y-3">
                {pendingApprovals.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-12">אין בקשות תורים הממתינות לאישור כרגע.</p>
                ) : (
                  pendingApprovals.map(app => (
                    <div key={app.id} className="bg-white border-2 border-dashed border-amber-200 bg-amber-50/20 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
                      <div className="text-right flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="font-bold text-slate-900 text-sm leading-none">{app.customer_name}</h4>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">ממתין</span>
                        </div>
                        <p className="text-xs font-black text-[#b8964f] mb-1">{app.service_title}</p>
                        <p className="text-[10px] text-slate-400 font-bold tabular-nums">
                          {formatHeDate(app.date)} • שעה: {app.start_time.slice(0,5)} - {app.end_time.slice(0,5)} • טל': {app.customer_phone}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button onClick={() => handleApproveBooking(app)} className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all">
                          <CheckCircle2 size={14} /> אישור תור
                        </button>
                        <button onClick={() => handleRejectBooking(app)} className="bg-red-50 text-red-600 border border-red-100 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all">
                          <X size={14} /> דחייה
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'daily' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-white/40 shadow-sm">
              <button onClick={() => changeDay(-1)} className="p-2.5 bg-[#FDFBF6] rounded-xl text-slate-400 active:scale-90 transition-all"><ChevronRight size={20}/></button>
              <div className="text-center cursor-pointer px-6 flex-1" onClick={() => setIsQuickCalendarOpen(true)}>
                <p className="text-[10px] font-black text-[#c9a961] uppercase tracking-[0.2em] mb-1">בחרי תאריך</p>
                <h2 className="text-base font-serif italic text-slate-900 flex items-center justify-center gap-1">
                  {formatHeDate(toLocalDateString(selectedDate))}
                </h2>
              </div>
              <button onClick={() => changeDay(1)} className="p-2.5 bg-[#FDFBF6] rounded-xl text-slate-400 active:scale-90 transition-all"><ChevronLeft size={20}/></button>
            </div>

            {isQuickCalendarOpen && (
              <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsQuickCalendarOpen(false)}>
                <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/60 shadow-2xl text-center max-w-sm w-full animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">ניווט מהיר ביומן</span>
                    <button onClick={() => setIsQuickCalendarOpen(false)} className="bg-slate-100 p-1.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setIsQuickCalendarOpen(false); } }}
                    modifiers={{ hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates }}
                    modifiersClassNames={{ hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' }}
                  />
                </div>
              </div>
            )}

            <div className="bg-white/60 backdrop-blur-2xl rounded-[2.5rem] p-5 border border-white/40 shadow-sm min-h-[500px]">
              <div className="space-y-3.5">
                {isFullBlocked ? (
                  <div className="py-24 text-center opacity-20 flex flex-col items-center gap-5 text-right"><Lock size={48}/><p className="text-sm uppercase tracking-widest font-black">יום חסום מלא</p></div>
                ) : (
                  timeSlots.map(time => {
                    const currentMinutes = timeToMinutes(time);
                    let isOutsideWorkHours = false;
                    if (currentDaySchedule) {
                      isOutsideWorkHours = (currentMinutes < timeToMinutes(currentDaySchedule.start_time) || currentMinutes >= timeToMinutes(currentDaySchedule.end_time));
                    } else {
                      isOutsideWorkHours = (currentMinutes < 9 * 60 || currentMinutes >= 16 * 60);
                    }
                    const isBreak = currentDayBreaks.some(bts => currentMinutes >= timeToMinutes(bts.start_time) && currentMinutes < timeToMinutes(bts.end_time));
                    const booking = dailyBookings.find(b => currentMinutes >= timeToMinutes(b.start_time) && currentMinutes < timeToMinutes(b.end_time));
                    if (booking && time !== booking.start_time.slice(0,5)) return null;
                    if (isOutsideWorkHours && !booking) return null;

                    return (
                      <div key={time} className="flex gap-4 items-start">
                        <div className="w-12 pt-3.5 text-[10px] font-black text-slate-300 tabular-nums">{time}</div>
                        <div className="flex-1">
                          {booking ? (
                            <div className={`bg-white border rounded-[1.5rem] p-4 flex justify-between items-center shadow-sm relative overflow-hidden text-right ${booking.status === 'pending' ? 'border-dashed border-amber-300 bg-amber-50/10' : 'border-slate-100'}`}>
                              <div className={`absolute right-0 top-0 bottom-0 w-1 ${booking.status === 'pending' ? 'bg-amber-400' : 'bg-[#c9a961]'}`}></div>
                              <div className="text-right">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-slate-900 text-sm leading-none">{booking.customer_name}</h4>
                                  {booking.status === 'pending' && <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase animate-pulse">ממתין לאישור</span>}
                                </div>
                                <p className="text-[9px] text-[#b8964f] font-black uppercase tracking-widest">{booking.service_title}</p>
                              </div>
                              <div className="flex gap-1.5">
                                {booking.status === 'pending' && (
                                  <button onClick={() => handleApproveBooking(booking)} className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center transition-transform active:scale-90" title="אישור מהיר"><CheckCircle2 size={14}/></button>
                                )}
                                <a href={`tel:${booking.customer_phone}`} className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Phone size={14}/></a>
                                <button onClick={() => window.open(`https://wa.me/972${booking.customer_phone.replace(/^0/, '')}`)} className="w-8 h-8 bg-green-50/50 rounded-lg flex items-center justify-center text-green-600/60"><MessageCircle size={14}/></button>
                                <button onClick={async () => { if (confirm('ביטול תור?')) { await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id); fetchData(); } }} className="w-8 h-8 bg-red-50/50 rounded-lg flex items-center justify-center text-red-400/60"><Trash2 size={14}/></button>
                              </div>
                            </div>
                          ) : isBreak ? (
                            <div className="h-12 bg-amber-50/40 border border-amber-100/50 rounded-2xl flex items-center px-5 text-amber-600/50 text-[10px] font-black uppercase tracking-widest gap-2.5">
                                <Hand size={12} /> הפסקה מוגדרת
                            </div>
                          ) : (
                            <div className="h-12 border border-dashed border-slate-200/60 rounded-2xl flex items-center px-5 text-slate-200 text-[10px] font-bold uppercase tracking-widest">פנוי</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-6 md:p-10 rounded-[2.5rem] border border-white/40 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2.5 mb-5"><CalendarIcon size={16} className="text-[#c9a961]"/><h2 className="text-xs font-bold uppercase tracking-widest">ניהול יומן</h2></div>
              <DayPicker mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} modifiers={{ hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates }} modifiersClassNames={{ hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' }} />
              <button onClick={async () => {
                const dStr = toLocalDateString(selectedDate);
                const existing = blockedDates.find(d => d.date === dStr);
                if (existing) await supabase.from('blocked_dates').delete().eq('date', dStr);
                else await supabase.from('blocked_dates').insert([{ date: dStr }]);
                fetchData();
              }} className="w-full mt-6 py-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">סגירה / פתיחה של יום מלא</button>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-6 md:p-10 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2.5 mb-5 text-right"><Hand size={15} className="text-[#c9a961]" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">הוספת הפסקה (חסימת שעות)</h2></div>
              <p className="text-[9px] text-slate-400 mb-4 leading-tight">לקוחות לא יוכלו קבוע תורים בשעות אלו.</p>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 text-right">
                  <input type="time" value={breakStartTime} onChange={e => setBreakStartTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-3 text-center outline-none text-sm font-bold" />
                  <input type="time" value={breakEndTime} onChange={e => setBreakEndTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-3 text-center outline-none text-sm font-bold" />
                </div>
                <button onClick={async () => {
                    await supabase.from('blocked_time_slots').insert({ date: toLocalDateString(selectedDate), start_time: breakStartTime, end_time: breakEndTime });
                    fetchData();
                }} className="w-full py-4 bg-[#c9a961] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all">הוסף הפסקה ביום זה</button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-6 md:p-10 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2.5 mb-5 text-right"><Sliders size={15} className="text-amber-500" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">מסגרת יום מותאמת</h2></div>
              <p className="text-[9px] text-slate-400 mb-4 leading-tight">הגדרת פתיחה וסגירה. ברירת מחדל: 09:00 - 16:00.</p>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 text-right">
                  <input type="time" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-3 text-center outline-none text-sm font-bold" />
                  <input type="time" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-3 text-center outline-none text-sm font-bold" />
                </div>
                <button onClick={async () => { 
                  await supabase.from('daily_schedules').upsert({ date: toLocalDateString(selectedDate), start_time: customHoursStartTime, end_time: customHoursEndTime }); 
                  fetchData(); 
                  alert('מסגרת העבודה עודכנה בהצלחה! 🎉');
                }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all">עדכון מסגרת עבודה</button>
                
                {/* לחצן דינמי למחיקה וחזרה לברירת מחדל */}
                {dailySchedules.some(ds => ds.date === toLocalDateString(selectedDate)) && (
                  <button 
                    onClick={async () => { 
                      await supabase.from('daily_schedules').delete().eq('date', toLocalDateString(selectedDate)); 
                      fetchData(); 
                      alert('היום הוחזר לשעות ברירת המחדל (09:00-16:00) בהצלחה! ✨');
                    }} 
                    className="w-full py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all mt-1"
                  >
                    חזרה לשעות ברירת מחדל (09:00-16:00)
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-3 mb-5"><AlertTriangle size={16} className="text-slate-700" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-700">פירוט חסימות והפסקות</h2></div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {[...futureBlockedList, ...futureSchedulesList, ...futureBreaksList].length === 0 ? <p className="text-xs text-slate-300 text-center py-6">אין חסימות או הפסקות עתידיות</p> : null}
                
                {futureBlockedList.map(bd => (
                  <div key={bd.date} className="flex justify-between items-center p-4 bg-red-50/50 rounded-xl border border-red-100/50">
                    <span className="text-xs font-bold text-red-800">{formatHeDate(bd.date)} <span className="text-[9px] ml-2 opacity-50 uppercase">יום סגור מלא</span></span>
                    <button onClick={async () => { await supabase.from('blocked_dates').delete().eq('date', bd.date); fetchData(); }} className="text-red-300"><X size={14}/></button>
                  </div>
                ))}

                {futureSchedulesList.map(ds => (
                  <div key={ds.date} className="flex justify-between items-center p-4 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <span className="text-xs font-bold text-slate-800">{formatHeDate(ds.date)} <span className="text-[9px] ml-2 opacity-50 uppercase">מסגרת: {ds.start_time.slice(0,5)}-{ds.end_time.slice(0,5)}</span></span>
                    <button onClick={async () => { await supabase.from('daily_schedules').delete().eq('date', ds.date); fetchData(); }} className="text-slate-300"><X size={14}/></button>
                  </div>
                ))}

                {futureBreaksList.map(bts => (
                  <div key={bts.id} className="flex justify-between items-center p-4 bg-amber-50/50 rounded-xl border border-amber-100/50">
                    <span className="text-xs font-bold text-amber-800">{formatHeDate(bts.date)} <span className="text-[9px] ml-2 opacity-50 uppercase">הפסקה: {bts.start_time.slice(0,5)}-{bts.end_time.slice(0,5)}</span></span>
                    <button onClick={async () => { await supabase.from('blocked_time_slots').delete().eq('id', bts.id); fetchData(); }} className="text-amber-400"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2.5 mb-2 border-b border-slate-100 pb-4">
                <Users size={18} className="text-[#c9a961]" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">מועדון לקוחות קבועות</h2>
              </div>
              <p className="text-[10px] text-slate-400 mb-4">רשימת הלקוחות הנאמנות שביצעו יותר מתור אחד במערכת (לא כולל המנהלת).</p>
             
              <div className="relative mb-5">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="חיפוש לקוחה לפי שם או טלפון..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-4 pr-11 py-3 text-right outline-none focus:border-[#c9a961] focus:bg-white transition-all text-sm font-medium"
                />
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {filteredCustomers.length === 0 ? (
                  <p className="text-xs text-slate-300 text-center py-12">
                    {searchTerm ? 'לא נמצאו לקוחות המתאימות לחיפוש.' : 'אין מספיק נתונים על לקוחות קבועות כרגע.'}
                  </p>
                ) : (
                  filteredCustomers.map(customer => {
                    const isExpanded = expandedCustomer === customer.phone;
                    
                    const customerHistory = bookings
                      .filter(b => b.customer_phone === customer.phone)
                      .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

                    return (
                      <div key={customer.phone} className="bg-white border border-slate-100/80 rounded-2xl overflow-hidden transition-all shadow-sm">
                        <div
                          onClick={() => setExpandedCustomer(isExpanded ? null : customer.phone)}
                          className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center font-bold text-xs tabular-nums text-white">
                              {customer.totalBookings}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm leading-none flex items-center gap-1.5">
                                {customer.name}
                                <Star size={12} className="text-[#c9a961] fill-[#c9a961]" />
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium tracking-tight mt-1 tabular-nums">{customer.phone}</p>
                            </div>
                          </div>
                          <div className="text-slate-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            <ChevronLeft size={16} />
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 bg-slate-50/40 border-t border-slate-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400">ביקור ראשון:</span>
                                <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatHeDate(customer.firstVisit)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400">ביקור אחרון:</span>
                                <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatHeDate(customer.lastVisit)}</span>
                              </div>
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 block"><Heart size={10} className="text-red-400 inline-block mr-1 fill-red-400"/> מועדף:</span>
                                <span className="text-[11px] font-black text-[#b8964f] truncate max-w-[120px]">{customer.favoriteService}</span>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-100 p-3.5">
                              <div className="flex items-center gap-1.5 mb-3 border-b border-slate-50 pb-2">
                                <History size={13} className="text-slate-400" />
                                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500">תקציר תורים קודמים ({customerHistory.length})</h5>
                              </div>
                              
                              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {customerHistory.map((historyItem) => (
                                  <div key={historyItem.id} className="flex justify-between items-center bg-[#FDFBF6]/60 p-2 rounded-lg border border-slate-100/50 text-right">
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{historyItem.service_title}</p>
                                      <p className="text-[9px] text-slate-400 font-medium tracking-tight mt-0.5 tabular-nums">
                                        {formatHeDate(historyItem.date)} • בשעה {historyItem.start_time.slice(0, 5)}
                                      </p>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${historyItem.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                      {historyItem.status === 'pending' ? 'ממתין' : historyItem.date >= todayStr ? 'עתידי' : 'בוצע'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <a href={`tel:${customer.phone}`} className="py-3 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
                                <Phone size={12}/> חיוג מהיר
                              </a>
                              <button onClick={() => window.open(`https://wa.me/972${customer.phone.replace(/^0/, '')}`)} className="py-3 bg-green-50 text-green-700 border border-green-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
                                <MessageCircle size={12}/> וואטסאפ מהיר
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- לשונית ניהול שירותים דינמית --- */}
        {activeTab === 'services' && (
          <div className="space-y-5 animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles size={18} className="text-[#c9a961]" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">מחירון ותפריט שירותים דינמי</h2>
                </div>
                <button
                  onClick={() => handleOpenServiceModal()}
                  className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={12} /> הוספת שירות
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-6">עדכון, הוספה ומחיקה של טיפולים המופיעים ישירות בדף הזימון הראשי של הלקוחות.</p>

              <div className="grid grid-cols-1 gap-3">
                {dbServices.map((service) => (
                  <div key={service.id} className="bg-[#FDFBF6]/40 border border-slate-100 p-5 rounded-2xl flex justify-between items-center shadow-sm text-right transition-all hover:bg-white">
                    <div className="text-right flex-1 pl-4">
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{service.title}</h4>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-[#b8964f] font-black">{service.price}</span>
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">• {service.duration} ({service.duration_minutes} דק')</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenServiceModal(service)}
                        className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {dbServices.length === 0 && (
                  <p className="text-xs text-slate-300 text-center py-12">אין שירותים רשומים כרגע בבסיס הנתונים.</p>
                )}
              </div>
            </div>

            {/* מודאל צף להוספה או עריכה של שירות */}
            {isServiceModalOpen && (
              <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsServiceModalOpen(false)}>
                <form
                  onSubmit={handleSaveService}
                  className="bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-[2.5rem] border border-white/60 shadow-2xl text-right max-w-sm w-full animate-in zoom-in-95 duration-200 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {editingService ? 'עריכת שירות קיים' : 'הוספת שירות חדש'}
                    </span>
                    <button type="button" onClick={() => setIsServiceModalOpen(false)} className="bg-slate-100 p-1.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">שם הטיפול</label>
                      <input
                        type="text"
                        required
                        value={serviceForm.title}
                        onChange={e => setServiceForm({...serviceForm, title: e.target.value})}
                        placeholder="לדוגמה: מבנה אנטומי - ג'ל"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-right outline-none focus:border-[#c9a961] focus:bg-white transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">מחיר לתצוגה</label>
                      <input
                        type="text"
                        required
                        value={serviceForm.price}
                        onChange={e => setServiceForm({...serviceForm, price: e.target.value})}
                        placeholder="לדוגמה: 150 ₪"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-right outline-none focus:border-[#c9a961] focus:bg-white transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">זמן טיפול לתצוגה</label>
                      <input
                        type="text"
                        required
                        value={serviceForm.duration}
                        onChange={e => setServiceForm({...serviceForm, duration: e.target.value})}
                        placeholder="לדוגמה: 90 דקות"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-right outline-none focus:border-[#c9a961] focus:bg-white transition-all text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">זמן בדקות (לחישוב ביומן)</label>
                      <input
                        type="number"
                        required
                        min={5}
                        max={300}
                        step={5}
                        value={serviceForm.duration_minutes}
                        onChange={e => setServiceForm({...serviceForm, duration_minutes: Number(e.target.value)})}
                        placeholder="לדוגמה: 90"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-right outline-none focus:border-[#c9a961] focus:bg-white transition-all text-sm font-medium tabular-nums"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md active:scale-95 transition-all pt-3.5"
                  >
                    {editingService ? 'עדכון שירות בדאטה' : 'שמירה והעלאה לאוויר'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white/80 backdrop-blur-xl p-7 rounded-[2.5rem] border border-white/40 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-7 border-b border-slate-100 pb-5 text-right"><History size={18} className="text-[#c9a961]" /><h2 className="text-xs font-black uppercase tracking-widest text-right">פעילות אחרונה</h2></div>
            <div className="space-y-5 relative before:absolute before:right-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 text-right">
              {activities.map(act => (
                <div key={act.id} className="relative pr-9 text-right">
                  <div className="absolute right-2.5 top-2 w-3 h-3 rounded-full bg-[#c9a961]/20 border border-[#c9a961] shadow-sm"></div>
                  <div className="bg-[#FDFBF6]/50 border border-slate-100 p-4 rounded-2xl text-right">
                    <p className="text-sm font-medium text-slate-800 leading-tight mb-2 text-right">{act.description || act.action}</p>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest text-right">{new Date(act.created_at).toLocaleDateString('he-IL')} • {new Date(act.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* בר ניווט תחתון משודרג עם 6 לשוניות מותאמות באופן מושלם */}
      <div className="fixed bottom-5 left-4 right-4 z-[120] max-w-md mx-auto">
        <div className="bg-slate-900/95 backdrop-blur-2xl rounded-[2rem] p-1.5 flex justify-between items-center shadow-2xl border border-white/10 gap-1">
          <button onClick={() => setActiveTab('daily')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'daily' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500'}`}>
            <Clock size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">לו"ז</span>
          </button>
          <button onClick={() => setActiveTab('approvals')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'approvals' ? 'bg-amber-500 text-white shadow-xl' : 'text-slate-500'}`}>
            <Bell size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">בקשות</span>
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'calendar' ? 'bg-[#c9a961] text-white shadow-xl' : 'text-slate-500'}`}>
            <CalendarIcon size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">ניהול</span>
          </button>
          <button onClick={() => setActiveTab('customers')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'customers' ? 'bg-[#c9a961] text-white shadow-xl' : 'text-slate-500'}`}>
            <Users size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">לקוחות</span>
          </button>
          <button onClick={() => setActiveTab('services')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'services' ? 'bg-[#c9a961] text-white shadow-xl' : 'text-slate-500'}`}>
            <Sparkles size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">שירותים</span>
          </button>
          <button onClick={() => setActiveTab('activity')} className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all ${activeTab === 'activity' ? 'bg-[#c9a961] text-white shadow-xl' : 'text-slate-500'}`}>
            <History size={14}/><span className="text-[7px] md:text-[8px] font-black uppercase mt-1">פעילות</span>
          </button>
        </div>
      </div>
    </div>
  );
}