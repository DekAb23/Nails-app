'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone, 
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X, Activity
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule, logActivity, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// --- רכיבי ממשק ---
function StatCard({ title, value, icon: Icon, color }: any) {
  const iconColorMap: any = {
    'bg-blue-500': 'text-blue-600',
    'bg-[#c9a961]': 'text-[#b8964f]',
    'bg-red-500': 'text-red-600',
  };
  const iconColor = iconColorMap[color] || 'text-slate-600';

  return (
    <div className="relative overflow-hidden bg-white/40 backdrop-blur-lg p-6 rounded-[2rem] border border-white/80 shadow-sm transition-all hover:border-[#c9a961]/30 group">
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
          <h3 className="text-4xl font-light text-slate-950 tabular-nums">{value}</h3>
        </div>
        <div className={`p-4 rounded-2xl ${color} bg-opacity-10 ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// --- רכיב התחברות ---
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
      if (authError) { setError('אימייל או סיסמה שגויים'); return; }
      if (data.session) onLoginSuccess();
    } catch (err) { setError('אירעה שגיאה בהתחברות'); } finally { setLoading(false); }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FDFBF6] px-4 font-sans selection:bg-[#c9a961]/20 relative">
      <div className="bg-white/60 backdrop-blur-2xl rounded-[3rem] border border-white/80 p-12 max-w-md w-full shadow-xl relative z-10 text-center">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#c9a961] to-[#f3d081] rounded-[2.5rem] mx-auto mb-6 flex items-center justify-center shadow-lg shadow-[#c9a961]/10">
            <Settings2 className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-serif italic text-slate-950 tracking-tight">כניסת מנהלת</h1>
          <p className="text-slate-500 mt-3 text-sm font-medium tracking-wide">מרכז בקרה - אדר קוסמטיקס</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mr-4 font-black">כתובת אימייל</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/40 border border-slate-100 rounded-full px-6 py-4 text-slate-900 focus:ring-1 focus:ring-[#c9a961] transition-all outline-none text-center" placeholder="email@example.com" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mr-4 font-black">מפתח אבטחה</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/40 border border-slate-100 rounded-full px-6 py-4 text-slate-900 focus:ring-1 focus:ring-[#c9a961] transition-all outline-none text-center" placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-600 text-xs text-center font-bold animate-pulse">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-5 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-full font-bold text-sm shadow-lg transition-all transform active:scale-[0.98]">
            {loading ? 'מאמת...' : 'כניסה ללוח הבקרה'}
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
  const [customHoursEndTime, setCustomHoursEndTime] = useState<string>('18:00');

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

  const handleDeleteSchedule = async (id: string | undefined, dateStr: string) => {
    if (!confirm('לבטל את שעות העבודה המיוחדות ליום זה?')) return;
    const { error } = await supabase.from('daily_schedules').delete().eq('date', dateStr);
    if (!error) {
      setDailySchedules(prev => prev.filter(ds => ds.date !== dateStr));
      await logActivity('blocked', `הסרת שעות מיוחדות: ${formatHeDate(dateStr)}`);
      fetchData();
    }
  };

  const handleDeleteBlockedDate = async (id: string | undefined, dateStr: string) => {
    if (!confirm('לפתוח את היום החסום?')) return;
    const { error } = await supabase.from('blocked_dates').delete().eq('date', dateStr);
    if (!error) {
      setBlockedDates(prev => prev.filter(bd => bd.date !== dateStr));
      await logActivity('blocked', `פתיחת יום חסום: ${formatHeDate(dateStr)}`);
      fetchData();
    }
  };

  const bookingDateObjects = useMemo(() => bookings.map(b => {
    const [y, m, d] = b.date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }), [bookings]);

  const blockedDateObjects = useMemo(() => 
    blockedDates.filter(bd => bd.date >= todayStr).map(bd => {
      const [y, m, d] = bd.date.split('-').map(Number);
      return new Date(y, m - 1, d);
  }), [blockedDates, todayStr]);

  const partialDateObjects = useMemo(() => 
    dailySchedules.filter(ds => ds.date >= todayStr).map(ds => {
      const [y, m, d] = ds.date.split('-').map(Number);
      return new Date(y, m - 1, d);
  }), [dailySchedules, todayStr]);

  const dailyBookings = useMemo(() => {
    const dateStr = toLocalDateString(selectedDate);
    return bookings.filter(b => b.date === dateStr).sort((a,b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, selectedDate]);

  const futureBlockedList = useMemo(() => blockedDates.filter(bd => bd.date >= todayStr), [blockedDates, todayStr]);
  const futureSchedulesList = useMemo(() => dailySchedules.filter(ds => ds.date >= todayStr), [dailySchedules, todayStr]);

  if (checkingAuth) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF6]">
      <div className="w-12 h-12 border-2 border-[#c9a961] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!session) return <LoginForm onLoginSuccess={() => fetchData()} />;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF6] text-slate-800 font-sans pb-20 selection:bg-[#c9a961]/10">
      
      <nav className="sticky top-0 z-50 bg-white/50 backdrop-blur-xl border-b border-slate-100 px-8 py-5">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#c9a961] to-[#f3d081] rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-xl font-serif italic text-slate-950 tracking-tight">מרכז שליטה</h1>
              <p className="text-[9px] text-[#b8964f] font-black uppercase tracking-[0.3em]">אדר קוסמטיקס v2.6</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-12 h-12 rounded-2xl bg-white/80 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-sm">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-8 mt-10 space-y-8 relative z-10">
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard title="תנועה יומית" value={bookings.filter(b => b.date === todayStr).length} icon={Clock} color="bg-blue-500" />
          <StatCard title="תורים פעילים" value={bookings.filter(b => b.date >= todayStr).length} icon={Users} color="bg-[#c9a961]" />
          <StatCard title="הגבלות מערכת" value={blockedDates.filter(bd => bd.date >= todayStr).length} icon={XCircle} color="bg-red-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-8">
            
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/80 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-[#c9a961]/10 flex items-center justify-center text-[#b8964f]"><CalendarIcon size={18}/></div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">ניהול לוח זמנים</h2>
              </div>
              
              <style jsx global>{`
                .rdp { --rdp-accent-color: #c9a961; width: 100%; margin: 0; color: #475569; }
                .rdp-day { border-radius: 14px; height: 50px; width: 50px; font-weight: 500; font-size: 0.9rem; transition: all 0.3s; position: relative; }
                .rdp-day_selected { background: #c9a961 !important; color: #fff !important; font-weight: 900 !important; }
                
                /* מירכוז מדויק של נקודת התור מתחת למספר */
                .rdp-day_hasBooking::after { 
                    content: ''; 
                    position: absolute; 
                    bottom: 4px; 
                    left: 50%; 
                    transform: translateX(-50%); 
                    width: 5px; 
                    height: 5px; 
                    background: #c9a961; 
                    border-radius: 50%; 
                }
                
                .rdp-day_blocked { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fecaca !important; }
                .rdp-day_partial { background: #fef9c3 !important; color: #854d0e !important; border: 1px solid #fef08a !important; }
                .rdp-day:hover:not(.rdp-day_selected) { background: #FCFBFA !important; }
              `}</style>
              
              <DayPicker 
                mode="single" 
                selected={selectedDate} 
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{ 
                    hasBooking: bookingDateObjects, 
                    blocked: blockedDateObjects, 
                    partial: partialDateObjects 
                }}
                modifiersClassNames={{ 
                    hasBooking: 'rdp-day_hasBooking', 
                    blocked: 'rdp-day_blocked', 
                    partial: 'rdp-day_partial' 
                }}
              />

              <button 
                onClick={async () => {
                  const dStr = toLocalDateString(selectedDate);
                  const existing = blockedDates.find(d => d.date === dStr);
                  if (existing) { await handleDeleteBlockedDate(existing.id, dStr); }
                  else {
                    const { data } = await supabase.from('blocked_dates').insert([{ date: dStr }]).select().single();
                    if (data) { setBlockedDates(prev => [...prev, data]); await logActivity('block', `נחסם יום: ${formatHeDate(dStr)}`); }
                  }
                  fetchData();
                }}
                className="w-full mt-8 py-5 bg-red-50 text-red-600 rounded-full border border-red-100 font-bold text-xs tracking-widest transition-all"
              >
                חסימה / פתיחה של היום
              </button>
            </div>

            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/80 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600"><Sliders size={18}/></div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">שעות עבודה להיום</h2>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-right">
                  <div className="space-y-2">
                    <p className="text-[9px] text-slate-400 uppercase font-black mr-2">התחלה</p>
                    <input type="time" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className="w-full bg-white border border-slate-100 rounded-full p-4 text-slate-900 text-center outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] text-slate-400 uppercase font-black mr-2">סיום</p>
                    <input type="time" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className="w-full bg-white border border-slate-100 rounded-full p-4 text-slate-900 text-center outline-none focus:ring-1 focus:ring-amber-500" />
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const dStr = toLocalDateString(selectedDate);
                    await supabase.from('daily_schedules').upsert({ date: dStr, start_time: customHoursStartTime, end_time: customHoursEndTime });
                    await logActivity('block', `עדכון שעות: ${formatHeDate(dStr)}`);
                    fetchData();
                  }}
                  className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-black text-[10px] uppercase tracking-[0.2em] transition-all"
                >
                  החל שעות מיוחדות
                </button>
              </div>
            </div>

            {/* רשימת חסימות עתידיות */}
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/80 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600"><AlertTriangle size={18}/></div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">חסימות והגבלות עתידיות</h2>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {futureBlockedList.length === 0 && futureSchedulesList.length === 0 && (
                   <p className="text-slate-400 text-center italic py-4 text-sm font-light">אין חסימות מתוזמנות</p>
                )}
                
                <div className="flex flex-col gap-3">
                  {futureBlockedList.map((bd) => (
                    <div key={`blocked-${bd.id}`} className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100 group shadow-sm">
                      <div className="flex flex-col text-right">
                          <span className="text-sm font-bold text-red-800">{formatHeDate(bd.date)}</span>
                          <span className="text-[10px] font-black uppercase text-red-400">יום חסום מלא</span>
                      </div>
                      <button onClick={() => handleDeleteBlockedDate(bd.id, bd.date)} className="p-2 text-red-300 hover:text-red-600 transition-colors bg-white rounded-xl shadow-sm"><X size={16} /></button>
                    </div>
                  ))}

                  {futureSchedulesList.map((ds) => (
                    <div key={`schedule-${ds.id}`} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100 group shadow-sm">
                      <div className="flex flex-col text-right">
                          <span className="text-sm font-bold text-amber-900">{formatHeDate(ds.date)}</span>
                          <span className="text-[10px] font-black uppercase text-amber-600">{ds.start_time.slice(0,5)} - {ds.end_time.slice(0,5)}</span>
                      </div>
                      <button onClick={() => handleDeleteSchedule(ds.id, ds.date)} className="p-2 text-amber-300 hover:text-amber-700 transition-colors bg-white rounded-xl shadow-sm"><X size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            
            {/* לו"ז יומי עם כפתור ביטול תור (הפח) */}
            <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-8 border border-white/80 shadow-sm min-h-[450px]">
              <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-6 text-right">
                <div>
                  <p className="text-[10px] text-[#b8964f] font-black uppercase tracking-[0.3em] mb-1.5">תצוגת יומן</p>
                  <h2 className="text-3xl font-serif italic text-slate-950 tracking-tight">{formatHeDate(toLocalDateString(selectedDate))}</h2>
                </div>
                <div className="bg-white border border-slate-100 px-4 py-1.5 rounded-full shadow-inner">
                   <span className="text-[11px] font-bold text-slate-500 tabular-nums uppercase">{dailyBookings.length} תורים קבועים</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {dailyBookings.length === 0 ? (
                  <div className="py-24 text-center opacity-10 flex flex-col items-center gap-4">
                    <CalendarIcon size={60} className="text-[#c9a961]" />
                    <p className="text-xl font-light text-slate-900">היומן ריק ליום זה</p>
                  </div>
                ) : (
                  dailyBookings.map(booking => (
                    <div key={booking.id} className="flex items-center justify-between p-5 bg-white/80 rounded-[2rem] border border-slate-100 hover:border-[#c9a961]/20 transition-all group shadow-sm">
                      <div className="flex items-center gap-6 text-right">
                        <div className="bg-[#FCFBFA] w-16 h-16 rounded-2xl flex items-center justify-center border border-slate-50 shadow-inner">
                          <span className="text-base font-light text-[#b8964f] tabular-nums">{booking.start_time.slice(0,5)}</span>
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-slate-950 tracking-tight">{booking.customer_name}</h4>
                          <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">{booking.service_title}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${booking.customer_phone}`} className="w-11 h-11 bg-white text-slate-400 rounded-xl flex items-center justify-center hover:text-[#b8964f] border border-slate-50 shadow-sm transition-all"><Phone size={18}/></a>
                        <button onClick={() => {
                          const phone = booking.customer_phone.startsWith('0') ? booking.customer_phone.slice(1) : booking.customer_phone;
                          window.open(`https://wa.me/972${phone}`, '_blank');
                        }} className="w-11 h-11 bg-white text-slate-400 rounded-xl flex items-center justify-center hover:text-green-600 border border-slate-50 shadow-sm transition-all"><MessageCircle size={18}/></button>
                        
                        {/* --- החזרת כפתור הפח לביטול תור --- */}
                        <button onClick={async () => {
                          if (confirm('לבטל תור?')) {
                            const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
                            if (!error) {
                                setBookings(prev => prev.filter(b => b.id !== booking.id));
                                await logActivity('cancel', `בוטל: ${booking.customer_name}`);
                                await fetchData();
                            }
                          }
                        }} className="w-11 h-11 bg-white text-red-400 rounded-xl flex items-center justify-center hover:text-red-600 border border-slate-50 shadow-sm transition-all">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* יומן פעילות */}
            <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-10 border border-white/80 shadow-sm">
              <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6 text-right">
                <div className="w-10 h-10 rounded-xl bg-[#c9a961]/10 flex items-center justify-center text-[#b8964f]"><History size={20}/></div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">יומן פעילות מערכת</h2>
              </div>
              <div className="space-y-6 relative before:absolute before:right-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100 text-right">
                {activities.map(act => (
                  <div key={act.id} className="relative pr-12 group">
                    <div className="absolute right-0 top-1 w-[40px] h-[40px] flex items-center justify-center">
                       <div className="w-2.5 h-2.5 rounded-full bg-[#c9a961] shadow-[0_0_10px_rgba(201,169,97,0.3)] transition-all group-hover:scale-150"></div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-900 leading-tight mb-1">{act.description}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest tabular-nums">
                            {new Date(act.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • סונכרן
                        </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}