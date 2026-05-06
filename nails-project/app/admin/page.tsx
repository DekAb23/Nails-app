'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone, 
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X, Activity, Lock, ChevronRight, ChevronLeft
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule, logActivity, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

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
    <div className={`backdrop-blur-2xl bg-white/60 border ${colorStyles[color].split(' ')[2]} p-2 md:p-3.5 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col items-center justify-center text-center`}>
      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">{title}</p>
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={colorStyles[color].split(' ')[1]} />
        <h3 className="text-sm md:text-2xl font-light text-slate-900 tabular-nums leading-none">{value}</h3>
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
        <form onSubmit={handleLogin} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-center outline-none focus:border-[#c9a961] transition-all text-sm" placeholder="אימייל" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-center outline-none focus:border-[#c9a961] transition-all text-sm" placeholder="סיסמה" required />
          <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all text-xs tracking-widest uppercase mt-4">התחברי</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'calendar' | 'activity'>('daily');
  const [isQuickCalendarOpen, setIsQuickCalendarOpen] = useState(false);
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [dailySchedules, setDailySchedules] = useState<DailySchedule[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customHoursStartTime, setCustomHoursStartTime] = useState<string>('09:00');
  const [customHoursEndTime, setCustomHoursEndTime] = useState<string>('16:00');

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const toLocalDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatHeDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  const fetchData = async () => {
    const { data: b } = await supabase.from('bookings').select('*').neq('status', 'cancelled').order('date');
    const { data: bd } = await supabase.from('blocked_dates').select('*').order('date');
    const { data: ds } = await supabase.from('daily_schedules').select('*').order('date');
    const { data: al } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
    setBookings(b || []); setBlockedDates(bd || []); setDailySchedules(ds || []); setActivities(al || []);
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

  // --- לוגיקת סימונים בלוח שנה ---
  const bookingDateObjects = useMemo(() => bookings.map(b => {
    const [y, m, d] = b.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }), [bookings]);

  const blockedDateObjects = useMemo(() => blockedDates.map(bd => {
    const [y, m, d] = bd.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }), [blockedDates]);

  const partialDateObjects = useMemo(() => 
    dailySchedules.filter(ds => ds.start_time !== '09:00' || ds.end_time !== '16:00').map(ds => {
      const [y, m, d] = ds.date.split('-').map(Number);
      return new Date(y, m - 1, d);
  }), [dailySchedules]);

  const pastDates = useMemo(() => ({ before: new Date(new Date().setHours(0, 0, 0, 0)) }), []);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 9; h <= 20; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const dailyBookings = useMemo(() => bookings.filter(b => b.date === toLocalDateString(selectedDate)).sort((a,b) => a.start_time.localeCompare(b.start_time)), [bookings, selectedDate]);
  const currentDaySchedule = useMemo(() => dailySchedules.find(ds => ds.date === toLocalDateString(selectedDate)), [dailySchedules, selectedDate]);
  const isFullBlocked = useMemo(() => blockedDates.some(bd => bd.date === toLocalDateString(selectedDate)), [blockedDates, selectedDate]);
  const futureBlockedList = useMemo(() => blockedDates.filter(bd => bd.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [blockedDates, todayStr]);
  const futureSchedulesList = useMemo(() => dailySchedules.filter(ds => ds.date >= todayStr && (ds.start_time !== '09:00' || ds.end_time !== '16:00')).sort((a,b) => a.date.localeCompare(b.date)), [dailySchedules, todayStr]);

  if (checkingAuth) return null;
  if (!session) return <LoginForm onLoginSuccess={() => fetchData()} />;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF6] text-slate-800 font-sans text-right pb-24 selection:bg-[#c9a961]/10">
      
      <style jsx global>{`
        .rdp { --rdp-accent-color: #c9a961; width: 100%; margin: 0; display: flex; justify-content: center; }
        .rdp-day { border-radius: 12px; height: 40px; width: 40px; font-weight: 500; font-size: 0.85rem; transition: all 0.2s; position: relative; }
        .rdp-day_selected { background: #c9a961 !important; color: #fff !important; font-weight: 900 !important; box-shadow: 0 4px 12px rgba(201,169,97,0.3); }
        .rdp-day_hasBooking::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; background: #c9a961; border-radius: 50%; }
        .rdp-day_blocked { background: #fee2e2 !important; color: #b91c1c !important; border: 1px solid #fecaca !important; }
        .rdp-day_partial { background: #fefce8 !important; color: #a16207 !important; border: 1px solid #fef08a !important; }
        .rdp-day_past { color: #cbd5e1 !important; pointer-events: auto; }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-[100] bg-[#FDFBF6]/95 backdrop-blur-2xl px-4 pt-6 pb-3 border-b border-slate-200/40 shadow-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white"><Activity size={14} /></div>
            <div>
              <h1 className="text-sm font-serif italic text-slate-900 leading-none">Console</h1>
              <p className="text-[7px] text-[#c9a961] font-black uppercase tracking-widest mt-1">אדר קוסמטיקס</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"><LogOut size={13} /></button>
        </div>
        
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2.5">
          <StatCard title="היום" value={bookings.filter(b => b.date === todayStr).length} icon={Clock} color="blue" />
          <StatCard title="פעילים" value={bookings.filter(b => b.date >= todayStr).length} icon={Users} color="gold" />
          <StatCard title="חסימות" value={blockedDates.filter(bd => bd.date >= todayStr).length} icon={XCircle} color="red" />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 mt-5">
        
        {activeTab === 'daily' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-3 rounded-3xl border border-white/40 shadow-sm">
              <button onClick={() => changeDay(-1)} className="p-2 bg-[#FDFBF6] rounded-xl text-slate-400 active:scale-90 transition-all"><ChevronRight size={16}/></button>
              <div className="text-center cursor-pointer px-4" onClick={() => setIsQuickCalendarOpen(true)}>
                <p className="text-[7px] font-black text-[#c9a961] uppercase tracking-[0.2em] mb-0.5">בחרי תאריך</p>
                <h2 className="text-sm font-serif italic text-slate-900">{formatHeDate(toLocalDateString(selectedDate))}</h2>
              </div>
              <button onClick={() => changeDay(1)} className="p-2 bg-[#FDFBF6] rounded-xl text-slate-400 active:scale-90 transition-all"><ChevronLeft size={16}/></button>
            </div>

            <div className="bg-white/60 backdrop-blur-2xl rounded-[2.5rem] p-4 border border-white/40 shadow-sm min-h-[500px]">
              <div className="space-y-2.5">
                {isFullBlocked ? (
                  <div className="py-24 text-center opacity-20 flex flex-col items-center gap-4 text-right"><Lock size={40}/><p className="text-xs uppercase tracking-widest font-black">יום חסום מלא</p></div>
                ) : (
                  timeSlots.map(time => {
                    const currentMinutes = timeToMinutes(time);
                    const isOutsideWorkHours = currentDaySchedule ? (currentMinutes < timeToMinutes(currentDaySchedule.start_time) || currentMinutes >= timeToMinutes(currentDaySchedule.end_time)) : false;
                    const booking = dailyBookings.find(b => currentMinutes >= timeToMinutes(b.start_time) && currentMinutes < timeToMinutes(b.end_time));
                    if (booking && time !== booking.start_time.slice(0,5)) return null;

                    return (
                      <div key={time} className="flex gap-3 items-start">
                        <div className="w-10 pt-3 text-[8px] font-black text-slate-300 tabular-nums">{time}</div>
                        <div className="flex-1">
                          {booking ? (
                            <div className="bg-white border border-slate-100 rounded-3xl p-3.5 flex justify-between items-center shadow-sm relative overflow-hidden text-right">
                              <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#c9a961]"></div>
                              <div className="text-right">
                                <h4 className="font-bold text-slate-900 text-xs leading-none mb-1.5">{booking.customer_name}</h4>
                                <p className="text-[7px] text-[#b8964f] font-black uppercase tracking-widest">{booking.service_title}</p>
                              </div>
                              <div className="flex gap-1.5">
                                <a href={`tel:${booking.customer_phone}`} className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Phone size={12}/></a>
                                <button onClick={() => window.open(`https://wa.me/972${booking.customer_phone.replace(/^0/, '')}`)} className="w-7 h-7 bg-green-50/50 rounded-lg flex items-center justify-center text-green-600/60"><MessageCircle size={12}/></button>
                                <button onClick={async () => { if (confirm('ביטול תור?')) { await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id); fetchData(); } }} className="w-7 h-7 bg-red-50/50 rounded-lg flex items-center justify-center text-red-400/60"><Trash2 size={12}/></button>
                              </div>
                            </div>
                          ) : isOutsideWorkHours ? (
                            <div className="h-10 bg-amber-50/40 border border-amber-100/50 rounded-2xl flex items-center px-4 text-amber-600/50 text-[7px] font-black uppercase tracking-tighter">חסום (שעות מותאמות)</div>
                          ) : (
                            <div className="h-10 border border-dashed border-slate-200/60 rounded-2xl flex items-center px-4 text-slate-200 text-[7px] font-bold uppercase tracking-widest">פנוי</div>
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
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2.5rem] border border-white/40 shadow-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-4"><CalendarIcon size={14} className="text-[#c9a961]"/><h2 className="text-[9px] font-bold uppercase tracking-widest">ניהול יומן</h2></div>
              <DayPicker mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} modifiers={{ hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates }} modifiersClassNames={{ hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' }} />
              <button onClick={async () => {
                const dStr = toLocalDateString(selectedDate);
                const existing = blockedDates.find(d => d.date === dStr);
                if (existing) await supabase.from('blocked_dates').delete().eq('date', dStr);
                else await supabase.from('blocked_dates').insert([{ date: dStr }]);
                fetchData();
              }} className="w-full mt-5 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all">סגירה / פתיחה של יום מלא</button>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2 mb-4 text-right"><Sliders size={13} className="text-amber-500" /><h2 className="text-[8px] font-black uppercase tracking-widest text-slate-500 text-right">שעות מותאמות (חסימה חלקית)</h2></div>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2 text-right">
                  <input type="time" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-2.5 text-center outline-none text-xs font-bold" />
                  <input type="time" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className="flex-1 bg-[#FDFBF6] border border-slate-100 rounded-xl p-2.5 text-center outline-none text-xs font-bold" />
                </div>
                <button onClick={async () => { await supabase.from('daily_schedules').upsert({ date: toLocalDateString(selectedDate), start_time: customHoursStartTime, end_time: customHoursEndTime }); fetchData(); }} className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[8px] uppercase tracking-widest shadow-md active:scale-95 transition-all">עדכון שעות</button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[2.5rem] border border-white/40 shadow-sm text-right">
              <div className="flex items-center gap-2 mb-4"><AlertTriangle size={14} className="text-red-500" /><h2 className="text-[8px] font-black uppercase tracking-widest text-slate-500">חסימות עתידיות ביומן</h2></div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {[...futureBlockedList, ...futureSchedulesList].length === 0 ? <p className="text-[8px] text-slate-300 text-center py-4">אין חסימות עתידיות</p> : null}
                {futureBlockedList.map(bd => (
                  <div key={bd.date} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                    <span className="text-[10px] font-bold text-red-800">{formatHeDate(bd.date)} <span className="text-[7px] ml-2 opacity-50 uppercase">יום מלא</span></span>
                    <button onClick={async () => { await supabase.from('blocked_dates').delete().eq('date', bd.date); fetchData(); }} className="text-red-300"><X size={12}/></button>
                  </div>
                ))}
                {futureSchedulesList.map(ds => (
                  <div key={ds.date} className="flex justify-between items-center p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                    <span className="text-[10px] font-bold text-amber-800">{formatHeDate(ds.date)} <span className="text-[7px] ml-2 opacity-50 uppercase">{ds.start_time.slice(0,5)}-{ds.end_time.slice(0,5)}</span></span>
                    <button onClick={async () => { await supabase.from('daily_schedules').delete().eq('date', ds.date); fetchData(); }} className="text-amber-300"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/40 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4 text-right"><History size={16} className="text-[#c9a961]" /><h2 className="text-[9px] font-black uppercase tracking-widest text-right">פעילות אחרונה</h2></div>
            <div className="space-y-4 relative before:absolute before:right-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 text-right">
              {activities.map(act => (
                <div key={act.id} className="relative pr-8 text-right">
                  <div className="absolute right-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#c9a961]/20 border border-[#c9a961] shadow-sm"></div>
                  <div className="bg-[#FDFBF6]/50 border border-slate-100 p-3.5 rounded-2xl text-right">
                    <p className="text-xs font-medium text-slate-800 leading-tight mb-1.5 text-right">{act.description}</p>
                    <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest text-right">{new Date(act.created_at).toLocaleDateString('he-IL')} • {new Date(act.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* QUICK CALENDAR MODAL */}
      {isQuickCalendarOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-right animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsQuickCalendarOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl relative z-10 w-full max-w-sm text-center text-right">
            <div className="flex justify-between items-center mb-5 px-1 text-right">
              <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-[#c9a961] text-right">בחרי תאריך</h3>
              <button onClick={() => setIsQuickCalendarOpen(false)} className="bg-slate-50 p-1.5 rounded-full text-slate-300"><X size={14}/></button>
            </div>
            <DayPicker mode="single" selected={selectedDate} onSelect={(d) => { if(d) { setSelectedDate(d); setIsQuickCalendarOpen(false); } }} modifiers={{ hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates }} modifiersClassNames={{ hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' }} />
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div className="lg:hidden fixed bottom-4 left-6 right-6 z-[120] max-w-xs mx-auto">
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl p-1 flex justify-between items-center shadow-2xl border border-white/5">
          <button onClick={() => setActiveTab('daily')} className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all ${activeTab === 'daily' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-500'}`}>
            <Clock size={14}/><span className="text-[6px] font-black uppercase mt-1">לו"ז</span>
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all ${activeTab === 'calendar' ? 'bg-[#c9a961] text-white shadow-xl' : 'text-slate-500'}`}>
            <CalendarIcon size={14}/><span className="text-[6px] font-black uppercase mt-1">ניהול</span>
          </button>
          <button onClick={() => setActiveTab('activity')} className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all ${activeTab === 'activity' ? 'bg-blue-500 text-white shadow-xl' : 'text-slate-500'}`}>
            <History size={14}/><span className="text-[6px] font-black uppercase mt-1">פעילות</span>
          </button>
        </div>
      </div>
    </div>
  );
}