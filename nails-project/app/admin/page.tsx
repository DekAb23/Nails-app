'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone, 
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X, Activity, RotateCcw
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule, logActivity, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// --- רכיבי ממשק קומפקטיים ---
function StatCard({ title, value, icon: Icon, color }: any) {
  const iconColorMap: any = {
    'bg-blue-500': 'text-blue-600',
    'bg-[#c9a961]': 'text-[#b8964f]',
    'bg-red-500': 'text-red-600',
  };
  const iconColor = iconColorMap[color] || 'text-slate-600';

  return (
    <div className="relative overflow-hidden bg-white/40 backdrop-blur-lg p-3 md:p-6 rounded-2xl md:rounded-[2rem] border border-white/80 shadow-sm flex flex-col items-center md:items-start text-center md:text-right group">
      <div className="flex items-center justify-between w-full relative z-10">
        <div className="flex-1 md:flex-none text-right">
          <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-tighter md:tracking-[0.2em] mb-0.5 md:mb-1">{title}</p>
          <h3 className="text-sm md:text-4xl font-light text-slate-950 tabular-nums">{value}</h3>
        </div>
        <div className={`hidden md:block p-4 rounded-2xl ${color} bg-opacity-10 ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
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
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FDFBF6] px-4 font-sans relative">
      <div className="bg-white/60 backdrop-blur-2xl rounded-[3rem] border border-white/80 p-12 max-w-md w-full shadow-xl relative z-10 text-center">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#c9a961] to-[#f3d081] rounded-[2.5rem] mx-auto mb-6 flex items-center justify-center shadow-lg shadow-[#c9a961]/10">
            <Settings2 className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-serif italic text-slate-950 tracking-tight">כניסת מנהלת</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/40 border border-slate-100 rounded-full px-6 py-4 text-slate-900 outline-none text-center" placeholder="email@example.com" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/40 border border-slate-100 rounded-full px-6 py-4 text-slate-900 outline-none text-center" placeholder="••••••••" required />
          <button type="submit" disabled={loading} className="w-full py-5 bg-[#c9a961] text-white rounded-full font-bold shadow-lg transform active:scale-[0.98]">
            כניסה ללוח הבקרה
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
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
    const { data: al } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(6);
    setBookings(b || []); setBlockedDates(bd || []); setDailySchedules(ds || []); setActivities(al || []);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session); setCheckingAuth(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const handleDeleteSchedule = async (dateStr: string) => {
    const { error } = await supabase.from('daily_schedules').delete().eq('date', dateStr);
    if (!error) { fetchData(); }
  };

  const handleDeleteBlockedDate = async (dateStr: string) => {
    const { error } = await supabase.from('blocked_dates').delete().eq('date', dateStr);
    if (!error) { fetchData(); }
  };

  // --- לוגיקת המודולטורים ליומן ---
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

  const dailyBookings = useMemo(() => {
    const dateStr = toLocalDateString(selectedDate);
    return bookings.filter(b => b.date === dateStr).sort((a,b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, selectedDate]);

  const futureBlockedList = useMemo(() => blockedDates.filter(bd => bd.date >= todayStr), [blockedDates, todayStr]);
  const futureSchedulesList = useMemo(() => 
    dailySchedules.filter(ds => ds.date >= todayStr && (ds.start_time !== '09:00' || ds.end_time !== '16:00')), 
    [dailySchedules, todayStr]
  );

  const hasSpecialHoursOnSelected = useMemo(() => {
    const dStr = toLocalDateString(selectedDate);
    return dailySchedules.some(ds => ds.date === dStr);
  }, [dailySchedules, selectedDate]);

  if (checkingAuth) return <div className="min-h-screen bg-[#FDFBF6]"></div>;
  if (!session) return <LoginForm onLoginSuccess={() => fetchData()} />;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF6] text-slate-800 font-sans pb-20 selection:bg-[#c9a961]/10 text-right">
      
      <nav className="sticky top-0 z-50 bg-white/50 backdrop-blur-xl border-b border-slate-100 px-4 md:px-8 py-3 md:py-5">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[#c9a961] rounded-xl flex items-center justify-center text-white shadow-lg"><Activity size={20} /></div>
            <div>
              <h1 className="text-sm md:text-xl font-serif italic text-slate-950">מרכז שליטה</h1>
              <p className="text-[8px] md:text-[9px] text-[#b8964f] font-black uppercase">אדר קוסמטיקס</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all"><LogOut size={18} /></button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 mt-4 md:mt-10 space-y-4 md:space-y-8 relative z-10">
        
        <div className="grid grid-cols-3 gap-2 md:gap-6">
          <StatCard title="היום" value={bookings.filter(b => b.date === todayStr).length} icon={Clock} color="bg-blue-500" />
          <StatCard title="פעילים" value={bookings.filter(b => b.date >= todayStr).length} icon={Users} color="bg-[#c9a961]" />
          <StatCard title="חסימות" value={blockedDates.filter(bd => bd.date >= todayStr).length} icon={XCircle} color="bg-red-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
          
          <div className="lg:col-span-8 order-1 lg:order-2 space-y-4 md:space-y-8">
            <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-4 md:p-8 border border-white/80 shadow-sm min-h-[400px]">
              <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[8px] md:text-[10px] text-[#b8964f] font-black uppercase mb-1">תצוגת יומן</p>
                  <h2 className="text-xl md:text-3xl font-serif italic text-slate-950 tracking-tight">{formatHeDate(toLocalDateString(selectedDate))}</h2>
                </div>
                <span className="bg-white border border-slate-100 px-3 py-1 rounded-full text-[10px] md:text-[11px] font-bold text-slate-500 uppercase">{dailyBookings.length} תורים</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {dailyBookings.length === 0 ? (
                  <div className="py-20 text-center opacity-10 flex flex-col items-center gap-4"><CalendarIcon size={60} className="text-[#c9a961]" /><p className="text-lg">אין תורים ליום זה</p></div>
                ) : (
                  dailyBookings.map(booking => (
                    <div key={booking.id} className="flex items-center justify-between p-3 md:p-5 bg-white/80 rounded-2xl md:rounded-[2rem] border border-slate-50 hover:border-[#c9a961]/20 transition-all shadow-sm">
                      <div className="flex items-center gap-4 text-right">
                        <div className="bg-[#FCFBFA] w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center border border-slate-50 shadow-inner">
                          <span className="text-sm md:text-base font-light text-[#b8964f]">{booking.start_time.slice(0,5)}</span>
                        </div>
                        <div>
                          <h4 className="text-sm md:text-lg font-medium text-slate-950 truncate max-w-[120px] md:max-w-none">{booking.customer_name}</h4>
                          <p className="text-[8px] md:text-[10px] text-slate-400 uppercase">{booking.service_title}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 md:gap-2">
                        <a href={`tel:${booking.customer_phone}`} className="w-8 h-8 md:w-11 md:h-11 bg-white text-slate-400 rounded-lg flex items-center justify-center border border-slate-50 shadow-sm"><Phone size={16}/></a>
                        <button onClick={() => window.open(`https://wa.me/972${booking.customer_phone.replace(/^0/, '')}`, '_blank')} className="w-8 h-8 md:w-11 md:h-11 bg-white text-green-500/60 rounded-lg flex items-center justify-center border border-slate-50 shadow-sm"><MessageCircle size={16}/></button>
                        <button onClick={async () => {
                          if (confirm('לבטל תור?')) { await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id); fetchData(); }
                        }} className="w-8 h-8 md:w-11 md:h-11 bg-white text-red-300 rounded-lg flex items-center justify-center border border-slate-50 shadow-sm"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/80 shadow-sm">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-6">
                <History size={20} className="text-[#b8964f]" />
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">יומן פעילות</h2>
              </div>
              <div className="space-y-6 relative before:absolute before:right-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 text-right">
                {activities.map(act => (
                  <div key={act.id} className="relative pr-12 group">
                    <div className="absolute right-0 top-1 w-[40px] h-[40px] flex items-center justify-center"><div className="w-2.5 h-2.5 rounded-full bg-[#c9a961] shadow-[0_0_10px_rgba(201,169,97,0.3)]"></div></div>
                    <div><p className="text-sm font-medium text-slate-900 leading-tight mb-1">{act.description}</p><p className="text-[10px] text-slate-400 uppercase tabular-nums">{new Date(act.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • סונכרן</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 order-2 lg:order-1 space-y-4 md:space-y-8">
            
            <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/80 shadow-sm text-center">
              <div className="flex items-center gap-3 mb-6 text-right">
                <CalendarIcon size={18} className="text-[#c9a961]" />
                <h2 className="text-xs md:text-sm font-black text-slate-950 uppercase tracking-widest">יומן חסימות</h2>
              </div>
              
              <style jsx global>{`
                .rdp { --rdp-accent-color: #c9a961; width: 100%; margin: 0; color: #475569; }
                .rdp-day { border-radius: 12px; height: 45px; width: 45px; font-weight: 500; font-size: 0.9rem; transition: all 0.3s; position: relative; }
                .rdp-day_selected { background: #c9a961 !important; color: #fff !important; font-weight: 900 !important; }
                
                /* ימים שעברו - אפור בהיר (חשוב שיהיה ראשון כדי שחסימות ידרסו במידת הצורך) */
                .rdp-day_past { color: #cbd5e1 !important; pointer-events: auto; opacity: 0.6; }

                .rdp-day_hasBooking::after { content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 5px; height: 5px; background: #c9a961; border-radius: 50%; }
                .rdp-day_blocked { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fecaca !important; }
                .rdp-day_partial { background: #fef9c3 !important; color: #854d0e !important; border: 1px solid #fef08a !important; }
                .rdp-day:hover:not(.rdp-day_selected) { background: #FCFBFA !important; }
              `}</style>
              
              <DayPicker mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} modifiers={{ hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates }} modifiersClassNames={{ hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' }} />

              <button onClick={async () => {
                  const dStr = toLocalDateString(selectedDate);
                  const existing = blockedDates.find(d => d.date === dStr);
                  if (existing) { await handleDeleteBlockedDate(dStr); }
                  else { await supabase.from('blocked_dates').insert([{ date: dStr }]); fetchData(); }
                }} className="w-full mt-6 py-4 bg-red-50 text-red-600 rounded-full border border-red-100 font-bold text-[10px] tracking-widest active:scale-95">חסימה / פתיחה של היום</button>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/80 shadow-sm">
              <div className="flex items-center gap-3 mb-6 text-right">
                <Sliders size={18} className="text-amber-600" />
                <h2 className="text-xs md:text-sm font-black text-slate-950 uppercase tracking-widest">שעות עבודה להיום</h2>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className="w-full bg-white border border-slate-100 rounded-full p-3 text-sm text-center outline-none" />
                  <input type="time" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className="w-full bg-white border border-slate-100 rounded-full p-3 text-sm text-center outline-none" />
                </div>
                
                <div className="flex gap-2">
                    <button onClick={async () => {
                        const dStr = toLocalDateString(selectedDate);
                        await supabase.from('daily_schedules').upsert({ date: dStr, start_time: customHoursStartTime, end_time: customHoursEndTime });
                        fetchData();
                    }} className="flex-1 py-4 bg-slate-900 text-white rounded-full font-bold text-[10px] tracking-widest active:scale-95 shadow-md">החל שעות</button>
                    
                    {/* כפתור איפוס שמופיע רק כשיש הגדרה במסד הנתונים */}
                    {hasSpecialHoursOnSelected && (
                        <button onClick={() => handleDeleteSchedule(toLocalDateString(selectedDate))} className="p-4 bg-amber-50 text-amber-600 rounded-full border border-amber-100 active:scale-95">
                            <RotateCcw size={16} />
                        </button>
                    )}
                </div>
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] p-6 md:p-8 border border-white/80 shadow-sm">
              <div className="flex items-center gap-3 mb-6 text-right">
                <AlertTriangle size={18} className="text-red-600" />
                <h2 className="text-xs md:text-sm font-black text-slate-950 uppercase tracking-widest">חסימות עתידיות</h2>
              </div>
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                <div className="flex flex-col gap-3">
                  {futureBlockedList.map((bd) => (
                    <div key={`blocked-${bd.date}`} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 shadow-sm text-right">
                      <div className="flex flex-col"><span className="text-xs font-bold text-red-800">{formatHeDate(bd.date)}</span><span className="text-[8px] font-black uppercase text-red-400">יום חסום מלא</span></div>
                      <button onClick={() => handleDeleteBlockedDate(bd.date)} className="p-1.5 text-red-300 hover:text-red-600 bg-white rounded-lg shadow-sm"><X size={14} /></button>
                    </div>
                  ))}
                  {futureSchedulesList.map((ds) => (
                    <div key={`schedule-${ds.date}`} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 shadow-sm text-right">
                      <div className="flex flex-col"><span className="text-xs font-bold text-amber-900">{formatHeDate(ds.date)}</span><span className="text-[8px] font-black uppercase text-amber-600">{ds.start_time.slice(0,5)} - {ds.end_time.slice(0,5)}</span></div>
                      <button onClick={() => handleDeleteSchedule(ds.date)} className="p-1.5 text-amber-300 hover:text-amber-700 bg-white rounded-lg shadow-sm"><X size={14} /></button>
                    </div>
                  ))}
                  {futureBlockedList.length === 0 && futureSchedulesList.length === 0 && (
                     <p className="text-slate-400 text-center italic py-4 text-[10px]">אין הגבלות עתידיות</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}