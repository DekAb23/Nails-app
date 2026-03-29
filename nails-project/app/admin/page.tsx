'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone, 
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule, logActivity, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// --- UI Components ---
function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <h3 className="text-xl font-bold text-slate-900">{value}</h3>
      </div>
    </div>
  );
}

// --- LoginForm Component (The Missing Piece) ---
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
      if (authError) {
        setError('אימייל או סיסמה שגויים');
        return;
      }
      if (data.session) onLoginSuccess();
    } catch (err) {
      setError('אירעה שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#F2F2F7] px-4 font-sans">
      <div className="bg-white rounded-[2rem] shadow-2xl p-10 max-w-md w-full border border-slate-50">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#c9a961] rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#c9a961]/20">
            <Settings2 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">לוח בקרה</h1>
          <p className="text-slate-400 mt-2">התחברי כדי לנהל את התורים</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-[#c9a961] transition-all"
            placeholder="אימייל"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-[#c9a961] transition-all"
            placeholder="סיסמה"
            required
          />
          {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl transition-all transform active:scale-[0.98]"
          >
            {loading ? 'מתחבר...' : 'כניסה למערכת'}
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatHeDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const fetchData = async () => {
    const { data: b } = await supabase.from('bookings').select('*').neq('status', 'cancelled').order('date');
    const { data: bd } = await supabase.from('blocked_dates').select('*').order('date');
    const { data: ds } = await supabase.from('daily_schedules').select('*').order('date');
    const { data: al } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10);
    setBookings(b || []);
    setBlockedDates(bd || []);
    setDailySchedules(ds || []);
    setActivities(al || []);
  };

  // --- Fixed Auth Sync ---
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setCheckingAuth(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const handleDeleteSchedule = async (id: string, dateStr: string) => {
    if (!confirm('לבטל את שעות העבודה המיוחדות ליום זה?')) return;
    await supabase.from('daily_schedules').delete().eq('id', id);
    await logActivity('blocked', `הסרת שעות מיוחדות: ${formatHeDate(dateStr)}`);
    fetchData();
  };

  const handleDeleteBlockedDate = async (id: string, dateStr: string) => {
    if (!confirm('לפתוח את היום החסום?')) return;
    await supabase.from('blocked_dates').delete().eq('id', id);
    await logActivity('blocked', `פתיחת יום חסום: ${formatHeDate(dateStr)}`);
    fetchData();
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

  const activeBlockedCount = useMemo(() => {
    return blockedDates.filter(bd => bd.date >= todayStr).length;
  }, [blockedDates, todayStr]);

  const futureBlocked = useMemo(() => blockedDates.filter(bd => bd.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [blockedDates, todayStr]);
  const futureSchedules = useMemo(() => dailySchedules.filter(ds => ds.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [dailySchedules, todayStr]);

  const dailyBookings = useMemo(() => {
    const dateStr = toLocalDateString(selectedDate);
    return bookings.filter(b => b.date === dateStr).sort((a,b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, selectedDate]);

  // --- Auth Screen Render ---
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="w-10 h-10 border-4 border-[#c9a961] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm onLoginSuccess={() => fetchData()} />;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F2F2F7] font-sans pb-10">
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#c9a961] rounded-xl flex items-center justify-center text-white shadow-lg"><Settings2 size={20} /></div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ניהול אדר קוסמטיקס</h1>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-red-500 transition-colors"><LogOut size={22} /></button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="תורים היום" value={bookings.filter(b => b.date === todayStr).length} icon={Clock} color="bg-blue-500" />
          <StatCard title="תורים פעילים" value={bookings.filter(b => b.date >= todayStr).length} icon={Users} color="bg-[#c9a961]" />
          <StatCard title="חסימות" value={activeBlockedCount} icon={XCircle} color="bg-red-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><CalendarIcon size={18}/> לוח שנה</h2>
              <style jsx global>{`
                .rdp { --rdp-accent-color: #c9a961; width: 100%; margin: 0; }
                .rdp-day { border-radius: 14px; height: 45px; width: 45px; font-weight: 600; position: relative; transition: all 0.2s; }
                .rdp-day_selected { background-color: #c9a961 !important; border-radius: 14px !important; color: white !important; }
                .rdp-day_hasBooking::after { content: ''; position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 5px; height: 5px; background: #c9a961; border-radius: 50%; }
                .rdp-day_blocked { background-color: #fff1f2 !important; color: #e11d48 !important; border: 1px solid #fecaca; }
                .rdp-day_partial { background-color: #fefce8 !important; color: #a16207 !important; border: 1px solid #fef08a; }
                .rdp-day_past:not(.rdp-day_selected) { opacity: 0.4; }
              `}</style>
              <DayPicker 
                mode="single" 
                selected={selectedDate} 
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{ 
                    hasBooking: bookingDateObjects, 
                    blocked: blockedDateObjects, 
                    partial: partialDateObjects,
                    past: (d) => d < new Date(new Date().setHours(0,0,0,0)) 
                }}
                modifiersClassNames={{ 
                    hasBooking: 'rdp-day_hasBooking', 
                    blocked: 'rdp-day_blocked', 
                    partial: 'rdp-day_partial',
                    past: 'rdp-day_past' 
                }}
              />
              <button 
                onClick={async () => {
                  const dStr = toLocalDateString(selectedDate);
                  const existing = blockedDates.find(d => d.date === dStr);
                  if (existing) {
                    await supabase.from('blocked_dates').delete().eq('date', dStr);
                    await logActivity('blocked', `חסימה הוסרה: ${formatHeDate(dStr)}`);
                  } else {
                    await supabase.from('blocked_dates').insert([{ date: dStr }]);
                    await logActivity('block', `נחסם יום מלא: ${formatHeDate(dStr)}`);
                  }
                  fetchData();
                }}
                className="w-full mt-4 py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all"
              >
                חסום/שחרר יום מלא
              </button>
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Sliders size={18}/> שעות מיוחדות</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="time" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-center font-bold" />
                  <input type="time" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-xl p-3 text-center font-bold" />
                </div>
                <button 
                  onClick={async () => {
                    const dStr = toLocalDateString(selectedDate);
                    await supabase.from('daily_schedules').upsert({ date: dStr, start_time: customHoursStartTime, end_time: customHoursEndTime });
                    await logActivity('block', `שעות מיוחדות ל-${formatHeDate(dStr)}: ${customHoursStartTime}-${customHoursEndTime}`);
                    fetchData();
                  }}
                  className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all"
                >
                  קבע שעות ליום
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-600"><AlertTriangle size={18}/> חסימות עתידיות</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {futureBlocked.length === 0 && futureSchedules.length === 0 ? (
                  <p className="text-slate-400 text-sm italic text-center py-4">אין חסימות עתידיות</p>
                ) : (
                  <>
                    {futureBlocked.map(bd => (
                      <div key={bd.id} className="flex items-center justify-between p-3 bg-red-50 rounded-2xl border border-red-100 group">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-red-700">{formatHeDate(bd.date)}</span>
                            <span className="text-[10px] font-black uppercase text-red-400">יום חסום מלא</span>
                        </div>
                        <button onClick={() => handleDeleteBlockedDate(bd.id!, bd.date)} className="p-2 text-red-300 hover:text-red-600 transition-colors bg-white rounded-xl shadow-sm">
                            <X size={16} />
                        </button>
                      </div>
                    ))}
                    {futureSchedules.map(ds => (
                      <div key={ds.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-2xl border border-yellow-100 group">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-yellow-800">{formatHeDate(ds.date)}</span>
                            <span className="text-[10px] font-black uppercase text-yellow-600">{ds.start_time.slice(0,5)} - {ds.end_time.slice(0,5)}</span>
                        </div>
                        <button onClick={() => handleDeleteSchedule(ds.id!, ds.date)} className="p-2 text-yellow-300 hover:text-yellow-600 transition-colors bg-white rounded-xl shadow-sm">
                            <X size={16} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-extrabold text-slate-900">לו"ז ל: {formatHeDate(toLocalDateString(selectedDate))}</h2>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">{dailyBookings.length} תורים</span>
              </div>
              <div className="space-y-3">
                {dailyBookings.length === 0 ? (
                  <div className="py-20 text-center opacity-20"><CalendarIcon size={48} className="mx-auto mb-2" /><p className="font-bold">אין תורים</p></div>
                ) : (
                  dailyBookings.map(booking => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-[22px] border border-transparent hover:border-[#c9a961]/30 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm">
                          <span className="text-sm font-black text-[#c9a961]">{booking.start_time.slice(0,5)}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-tight">{booking.customer_name}</h4>
                          <p className="text-xs text-slate-400 font-medium">{booking.service_title}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={`tel:${booking.customer_phone}`} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm hover:text-[#c9a961] transition-colors"><Phone size={18}/></a>
                        <button onClick={() => {
                          const phone = booking.customer_phone.startsWith('0') ? booking.customer_phone.slice(1) : booking.customer_phone;
                          window.open(`https://wa.me/972${phone}`, '_blank');
                        }} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm hover:text-green-500 transition-colors"><MessageCircle size={18}/></button>
                        <button onClick={async () => {
                          if (confirm('לבטל תור?')) {
                            await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
                            await logActivity('cancel', `בוטל: ${booking.customer_name}`);
                            fetchData();
                          }
                        }} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800"><History size={18}/> פעילות אחרונה</h2>
              <div className="space-y-6 relative before:absolute before:right-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-50">
                {activities.map(act => (
                  <div key={act.id} className="relative pr-8">
                    <div className="absolute right-0 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#c9a961] z-10 shadow-sm"></div>
                    <p className="text-sm font-bold text-slate-800 leading-tight">{act.description}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                        {new Date(act.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} • {formatHeDate(toLocalDateString(new Date(act.created_at)))}
                    </p>
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