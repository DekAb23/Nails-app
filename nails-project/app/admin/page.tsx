'use client';

import { useState, useEffect, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  Calendar as CalendarIcon, Users, Clock, XCircle, Phone,
  MessageCircle, Trash2, Settings2, LogOut, History, Sliders, AlertTriangle, X, Activity, Lock,
  ChevronRight, ChevronLeft, Hand, Star, Heart, Search, Sparkles, Edit3, Plus, Bell, CheckCircle2,
  Eye, MoonStar, Loader2, CalendarDays, Inbox, CheckCheck, BarChart3
} from 'lucide-react';
import { supabase, Booking, BlockedDate, DailySchedule } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/* ------------------------------------------------------------------ *
 * Design tokens
 * ------------------------------------------------------------------ */

const GOLD = '#c9a961';
const GOLD_DEEP = '#b8964f';

/** Rich frosted glass — the primary surface for every panel. */
const CARD =
  'rounded-3xl border border-slate-900/[0.06] bg-white/85 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl';
/** Inset well used for closed slots and textured sub-surfaces. */
const INSET = 'rounded-2xl border border-dashed border-slate-200 bg-slate-900/[0.03]';
/** Warm gold gradient for VIP treatments and accents. */
const GOLD_GRADIENT = 'bg-gradient-to-br from-[#e0c98a] via-[#c9a961] to-[#a8874a]';
/** Hairline used for the timeline track and inner dividers. */
const HAIRLINE = 'border-slate-900/[0.06]';
const INPUT =
  'w-full rounded-2xl border border-slate-900/[0.06] bg-white/70 px-3 py-2.5 text-center text-[13px] font-semibold tabular-nums tracking-tight outline-none transition-all focus:border-[#c9a961]/50 focus:bg-white focus:ring-4 focus:ring-[#c9a961]/10';
const BTN_DARK =
  'flex w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-900 py-3 text-[11px] font-semibold tracking-tight text-white shadow-[0_2px_10px_-2px_rgba(15,23,42,0.35)] transition-all active:scale-95';
const BTN_GOLD =
  'flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#c9a961] py-3 text-[11px] font-semibold tracking-tight text-white shadow-[0_2px_10px_-2px_rgba(201,169,97,0.45)] transition-all active:scale-95';
/** Apple-style circular quick action. */
const ACTION_CIRCLE =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all active:scale-90';
/** Right-aligned text field inside sheets. */
const FIELD =
  'w-full rounded-2xl border border-slate-900/[0.06] bg-white/70 px-3.5 py-3 text-right text-[14px] font-normal tracking-tight outline-none transition-all placeholder:text-slate-300 focus:border-[#c9a961]/50 focus:bg-white focus:ring-4 focus:ring-[#c9a961]/10';
const FIELD_LABEL = 'mb-1.5 block text-[10px] font-medium tracking-tight text-slate-400';
/** Dimmed, blurred scrim behind sheets. */
const SCRIM = 'fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-lg';
/** iOS sheet surface. */
const SHEET =
  'anim-pop w-full rounded-[1.75rem] border border-white/60 bg-white/85 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.28)] backdrop-blur-2xl';

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

type AdminTab = 'daily' | 'approvals' | 'calendar' | 'customers' | 'services' | 'activity';

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Extract numeric ILS amount from a display price string (e.g. "150 ₪"). */
const parsePrice = (price: unknown): number => {
  if (typeof price === 'number' && Number.isFinite(price)) return price;
  if (typeof price !== 'string') return 0;
  const digits = price.replace(/[^\d.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

const formatILS = (amount: number) =>
  `₪${Math.round(amount).toLocaleString('he-IL')}`;

const formatWorkDuration = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} דק'`;
  if (m === 0) return `${h} שע'`;
  return `${h}:${String(m).padStart(2, '0')} שע'`;
};

/* ------------------------------------------------------------------ *
 * Presentational building blocks
 * ------------------------------------------------------------------ */

/** Tier 2 of the bento: a single metric tile with a gold accent number. */
function MetricTile({
  label,
  value,
  icon: Icon,
  tone = 'slate',
  onClick,
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: 'slate' | 'gold' | 'amber' | 'red';
  onClick?: () => void;
}) {
  const tones = {
    slate: { icon: 'text-slate-300', value: 'text-slate-900' },
    gold: { icon: 'text-[#c9a961]', value: 'text-[#b8964f]' },
    amber: { icon: 'text-amber-400', value: 'text-amber-600' },
    red: { icon: 'text-red-300', value: 'text-red-500' },
  } as const;

  const Element: any = onClick ? 'button' : 'div';

  return (
    <Element
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-white/60 px-1 py-2 ring-1 ring-inset ring-slate-900/[0.04] transition-all ${
        onClick ? 'active:scale-95' : ''
      }`}
    >
      <div className="flex items-center gap-1">
        <Icon size={10} className={`${tones[tone].icon} shrink-0`} />
        <span className={`text-[17px] font-semibold leading-none tracking-tight tabular-nums ${tones[tone].value}`}>
          {value}
        </span>
      </div>
      <span className="truncate text-[8.5px] font-medium leading-none tracking-tight text-slate-400">{label}</span>
    </Element>
  );
}

/** Gold-gradient VIP marker for loyal customers. */
function VipBadge({ count }: { count: number }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full ${GOLD_GRADIENT} px-2 py-[0.1875rem] shadow-[0_2px_8px_-2px_rgba(201,169,97,0.6)]`}
    >
      <Star size={8} className="fill-white text-white" />
      <span className="text-[9px] font-semibold leading-none tabular-nums text-white">{count}</span>
    </span>
  );
}

/** Compact contact affordance used on customer cards. */
function ContactChip({
  icon: Icon,
  label,
  href,
  onClick,
  tone,
}: {
  icon: any;
  label: string;
  href?: string;
  onClick?: () => void;
  tone: 'slate' | 'green';
}) {
  const tones = {
    slate: 'bg-white/80 text-slate-700 ring-slate-900/[0.06]',
    green: 'bg-green-50/80 text-green-700 ring-green-600/10',
  } as const;

  const cls = `flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-semibold tracking-tight ring-1 ring-inset transition-all active:scale-95 ${tones[tone]}`;

  if (href) {
    return (
      <a href={href} className={cls}>
        <Icon size={13} /> {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      <Icon size={13} /> {label}
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
  accent = GOLD_DEEP,
}: {
  icon: any;
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${accent}14`, color: accent }}
          >
            <Icon size={12} />
          </span>
          <h2 className="truncate font-sans text-[15px] font-semibold not-italic leading-tight tracking-tight text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {description && (
        <p className="mt-1.5 text-[10.5px] font-normal leading-relaxed tracking-tight text-slate-400">{description}</p>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-900/[0.05] bg-white/70 text-slate-300 shadow-[0_1px_6px_-2px_rgba(0,0,0,0.05)]">
        <Icon size={18} />
      </div>
      <div>
        <p className="font-sans text-base font-medium not-italic leading-tight text-slate-500">{title}</p>
        {description && (
          <p className="mt-1 text-[10.5px] font-normal tracking-tight text-slate-400">{description}</p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-900/[0.05] bg-white/70 px-2 py-2.5 text-center shadow-[0_1px_6px_-2px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <p className="text-[16px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">{value}</p>
      <p className="mt-1.5 truncate text-[8.5px] font-medium leading-none tracking-tight text-slate-400">{label}</p>
    </div>
  );
}

/** Luxury status badge. Emerald = confirmed, amber = pending, slate = closed/break. */
function Badge({ tone, children }: { tone: 'emerald' | 'amber' | 'slate' | 'gold'; children: React.ReactNode }) {
  const tones = {
    emerald: 'bg-emerald-50/80 text-emerald-700 ring-emerald-600/10',
    amber: 'bg-amber-50/80 text-amber-700 ring-amber-600/10',
    slate: 'bg-slate-100/70 text-slate-400 ring-slate-600/5',
    gold: 'bg-[#c9a961]/10 text-[#b8964f] ring-[#c9a961]/15',
  } as const;

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-[0.1875rem] text-[8.5px] font-semibold not-italic leading-tight tracking-tight ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusChip({ status }: { status?: string }) {
  if (status === 'pending') return <Badge tone="amber">ממתין</Badge>;
  return <Badge tone="emerald">מאושר</Badge>;
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
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FDFBF6] px-4 text-right font-sans">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#c9a961]/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-slate-300/20 blur-3xl" />
      </div>

      <div className="anim-pop relative w-full max-w-[20rem] rounded-[2rem] border border-slate-900/[0.05] bg-white/75 p-7 text-center shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[1.125rem] bg-slate-900 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.5)]">
          <Settings2 className="h-6 w-6 text-white" />
        </div>
        <h1 className="font-sans text-[22px] font-semibold not-italic leading-tight tracking-tight text-slate-900">כניסת מנהלת</h1>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#c9a961]">אדר קוסמטיקס</p>

        <form onSubmit={handleLogin} className="mt-7 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-slate-900/[0.06] bg-white/70 px-4 py-3.5 text-center text-[15px] tracking-tight outline-none transition-all placeholder:text-slate-300 focus:border-[#c9a961]/50 focus:bg-white focus:ring-4 focus:ring-[#c9a961]/10"
            placeholder="אימייל"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-slate-900/[0.06] bg-white/70 px-4 py-3.5 text-center text-[15px] tracking-tight outline-none transition-all placeholder:text-slate-300 focus:border-[#c9a961]/50 focus:bg-white focus:ring-4 focus:ring-[#c9a961]/10"
            placeholder="סיסמה"
            required
          />
          {error && (
            <p className="anim-fade-up rounded-2xl bg-red-50/80 py-2.5 text-[11px] font-semibold tracking-tight text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-[14px] font-semibold tracking-tight text-white shadow-[0_4px_16px_-4px_rgba(15,23,42,0.45)] transition-all active:scale-95 disabled:opacity-60"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            התחברי
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('daily');
  const [isQuickCalendarOpen, setIsQuickCalendarOpen] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [dailySchedules, setDailySchedules] = useState<DailySchedule[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [dbServices, setDbServices] = useState<any[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceForm, setServiceForm] = useState({ title: '', price: '', duration: '', duration_minutes: 30 });

  // Smart Manual Booking modal (additive feature)
  const [isManualBookingOpen, setIsManualBookingOpen] = useState(false);
  const [savingManualBooking, setSavingManualBooking] = useState(false);
  const [manualBookingForm, setManualBookingForm] = useState({
    serviceId: '',
    date: '',
    startTime: '',
    customerName: '',
    customerPhone: '',
    sendSms: true,
  });

  // Zero-footprint analytics sheet (additive UI only)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customHoursStartTime, setCustomHoursStartTime] = useState<string>('09:00');
  const [customHoursEndTime, setCustomHoursEndTime] = useState<string>('16:00');
  const [breakStartTime, setBreakStartTime] = useState<string>('14:00');
  const [breakEndTime, setBreakEndTime] = useState<string>('16:00');

  const [maxCalendarOpenDate, setMaxCalendarOpenDate] = useState<string>('');
  const [savingMaxDate, setSavingMaxDate] = useState(false);

  // Presentational only: replaces the native alert() popups with an in-app toast.
  const [toast, setToast] = useState<{ id: number; message: string; tone: 'success' | 'error' } | null>(null);
  const showToast = (message: string, tone: 'success' | 'error' = 'success') =>
    setToast({ id: Date.now(), message, tone });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Presentational only: drives the live "now" indicator on the timeline.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const toLocalDateString = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

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
    if (dateStr === '2035-12-31') return 'הגדרת יומן';
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  const formatHeWeekday = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('he-IL', { weekday: 'long' });
  };

  const fetchData = async () => {
    const { data: b } = await supabase.from('bookings').select('*').neq('status', 'cancelled').order('date');
    const { data: bd } = await supabase.from('blocked_dates').select('*').order('date');
    const { data: ds } = await supabase.from('daily_schedules').select('*').order('date');
    const { data: bts } = await supabase.from('blocked_time_slots').select('*').order('date');
    const { data: al } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
    const { data: s } = await supabase.from('services').select('*').order('created_at', { ascending: true });

    setBookings(b || []); 
    setBlockedDates(bd || []); 
    setDailySchedules(ds || []); 
    setBlockedTimeSlots(bts || []); 
    setActivities(al || []);
    setDbServices(s || []);

    const maxDateSetting = ds?.find(item => item.date === '2035-12-31');
    if (maxDateSetting) {
      setMaxCalendarOpenDate(maxDateSetting.start_time);
    } else {
      const defaultMax = new Date();
      defaultMax.setMonth(defaultMax.getMonth() + 2);
      setMaxCalendarOpenDate(toLocalDateString(defaultMax));
    }
  };

  const handleUpdateMaxCalendarDate = async () => {
    if (!maxCalendarOpenDate) return;
    setSavingMaxDate(true);
    try {
      // 1. קודם כל מוחקים את הרשומה הישנה כדי למנוע כפילויות או בעיות UPDATE
      await supabase.from('daily_schedules').delete().eq('date', '2035-12-31');
      
      // 2. עכשיו עושים INSERT נקי שתמיד מאושר ומצליח במערכת
      const { error } = await supabase.from('daily_schedules').insert([{
        date: '2035-12-31',
        start_time: maxCalendarOpenDate,
        end_time: '00:00'
      }]);
      
      if (error) throw error;
      showToast('טווח פתיחת היומן ללקוחות עודכן בהצלחה! 🎉');
      fetchData();
    } catch (e) {
      showToast('שגיאה בעדכון טווח היומן.', 'error');
    } finally {
      setSavingMaxDate(false);
    }
  };

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
      showToast('שגיאה באישור התור במערכת', 'error');
    }
  };

  const handleRejectBooking = async (booking: Booking) => {
    if (!confirm(`האם את בטוחה שברצונך לדחות ולמחוק את בקשת התור של ${booking.customer_name}?`)) return;
    try {
      const [year, month, day] = booking.date.split('-').map(Number);
      const formattedDate = `${day}/${month}`;
      const formattedTime = booking.start_time.slice(0, 5);
      const rejectionMessage = `היי ${booking.customer_name},\nלצערנו אין באפשרותנו לאשר את בקשת התור בתאריך ${formattedDate} בשעה ${formattedTime}.\nנשמח לתאם מועד חלופי באתר! ❤️`;

      try {
        await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: booking.customer_phone,
            message: rejectionMessage,
            isDirectMessage: true,
          }),
        });
      } catch (smsErr) {
        console.error('Rejection SMS bypassed or failed:', smsErr);
      }

      const { error } = await supabase.from('bookings').delete().eq('id', booking.id);
      if (error) throw error;
      await fetchData();
    } catch (e) {
      showToast('שגיאה בדחיית התור', 'error');
    }
  };

  const openManualBookingModal = () => {
    setManualBookingForm({
      serviceId: dbServices[0]?.id ?? '',
      date: toLocalDateString(selectedDate),
      startTime: '',
      customerName: '',
      customerPhone: '',
      sendSms: true,
    });
    setIsManualBookingOpen(true);
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingManualBooking) return;

    const customerName = manualBookingForm.customerName.trim();
    const phoneDigits = String(manualBookingForm.customerPhone || '').replace(/\D/g, '');
    const selectedService = dbServices.find((s) => s.id === manualBookingForm.serviceId) as any;
    const selectedTime = (manualBookingForm.startTime || '').slice(0, 5);

    if (!customerName) {
      showToast('אנא מלאי את כל השדות ובחרי שעה פנויה.', 'error');
      return;
    }

    if (!/^05\d{8}$/.test(phoneDigits)) {
      showToast('נא להזין מספר טלפון נייד תקין בן 10 ספרות (המתחיל ב-05)', 'error');
      return;
    }

    if (!selectedService || !/^\d{2}:\d{2}$/.test(selectedTime)) {
      showToast('אנא מלאי את כל השדות ובחרי שעה פנויה.', 'error');
      return;
    }

    const targetDate =
      selectedDate instanceof Date
        ? selectedDate
        : new Date((selectedDate as any) || manualBookingForm.date || Date.now());
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr =
      manualBookingForm.date && /^\d{4}-\d{2}-\d{2}$/.test(manualBookingForm.date)
        ? manualBookingForm.date
        : `${year}-${month}-${day}`;

    const duration =
      parseInt(
        String(
          selectedService?.durationMinutes ||
            selectedService?.duration_minutes ||
            selectedService?.duration ||
            60
        ),
        10
      ) || 60;
    const [h, m] = selectedTime.split(':').map(Number);
    const totalMinutes = (h || 0) * 60 + (m || 0) + duration;
    const endH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const endM = String(totalMinutes % 60).padStart(2, '0');
    const endTimeStr = `${endH}:${endM}`;

    const startMins = (h || 0) * 60 + (m || 0);
    const endMins = totalMinutes;

    if (blockedDates.some((bd) => bd.date === dateStr)) {
      showToast('היום חסום במלואו — לא ניתן לקבוע תור.', 'error');
      return;
    }

    const schedule = dailySchedules.find((ds) => ds.date === dateStr && ds.date !== '2035-12-31');
    const workStart = schedule ? timeToMinutes(schedule.start_time) : 9 * 60;
    const workEnd = schedule ? timeToMinutes(schedule.end_time) : 16 * 60;
    if (startMins < workStart || endMins > workEnd) {
      showToast('השעה שנבחרה מחוץ לשעות העבודה.', 'error');
      return;
    }

    const hitsBreak = blockedTimeSlots.some(
      (bts) =>
        bts.date === dateStr &&
        startMins < timeToMinutes(bts.end_time) &&
        endMins > timeToMinutes(bts.start_time)
    );
    if (hitsBreak) {
      showToast('השעה חופפת להפסקה מוגדרת.', 'error');
      return;
    }

    const hitsBooking = bookings.some(
      (b) =>
        b.date === dateStr &&
        (b.status === 'confirmed' || b.status === 'pending') &&
        b.customer_phone !== '0508917748' &&
        startMins < timeToMinutes(b.end_time) &&
        endMins > timeToMinutes(b.start_time)
    );
    if (hitsBooking) {
      showToast('השעה כבר תפוסה. בחרי שעה אחרת.', 'error');
      return;
    }

    setSavingManualBooking(true);
    try {
      const serviceTitle = selectedService?.title || selectedService?.name || 'טיפול';
      const newBooking: any = {
        service_id: String(selectedService?.id || 'manual'),
        service_title: serviceTitle,
        service_duration: duration,
        date: dateStr,
        start_time: selectedTime.slice(0, 5),
        end_time: endTimeStr,
        customer_name: customerName.trim(),
        customer_phone: phoneDigits,
        cancellation_token:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : uuidv4(),
        status: 'confirmed',
        is_verified: true,
      };

      let { data, error } = await supabase.from('bookings').insert([newBooking]).select().single();

      // Fallback in case table uses service_name instead of service_title
      if (error && (error.message?.includes('service_title') || error.details?.includes('service_title'))) {
        delete newBooking.service_title;
        newBooking.service_name = serviceTitle;
        const retry = await supabase.from('bookings').insert([newBooking]).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Manual booking DB error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        showToast('שגיאה בשמירת התור הידני', 'error');
        return;
      }

      const [, mm, dd] = dateStr.split('-');
      const formattedDate = `${Number(dd)}/${Number(mm)}`;
      const formattedTime = selectedTime.slice(0, 5);

      if (manualBookingForm.sendSms) {
        try {
          const customerMessage = `היי ${customerName},\nהתור שלך אושר בהצלחה! 🎉\n\n${serviceTitle}\nבתאריך ${formattedDate} בשעה ${formattedTime}\nבכתובת מור 5 א', קומה 6 דירה 25.\n\nשימי לב -\nהשלמה/תיקון בתוספת 10 ש"ח לציפורן.\nאי געה לתור או ביטול בפחות מ24 שעות מותנה בתשלום של 50% מסך הטיפול.\n\nנתראה! ❤️`;
          await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneDigits, message: customerMessage, isDirectMessage: true }),
          });
        } catch (smsErr) {
          console.error('SMS Send bypassed or failed:', smsErr);
        }
      }

      try {
        await supabase.from('activity_log').insert([
          {
            id: uuidv4(),
            action: `תור נקבע ידנית עבור ${customerName} לתאריך ${formattedDate} בשעה ${formattedTime}`,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (logErr) {
        console.error('Activity log insert failed (non-blocking):', logErr);
      }

      setManualBookingForm({
        serviceId: dbServices[0]?.id ?? '',
        date: toLocalDateString(selectedDate),
        startTime: '',
        customerName: '',
        customerPhone: '',
        sendSms: true,
      });
      setIsManualBookingOpen(false);
      await fetchData();
      showToast('התור נקבע בהצלחה! 🎉');
    } catch (err) {
      console.error(err);
      showToast('שגיאה בקביעת התור הידני.', 'error');
    } finally {
      setSavingManualBooking(false);
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
      showToast('אנא מלאי את כל השדות בשירות.', 'error');
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
      showToast('שגיאה בשמירת השירות.', 'error');
    } else {
      setIsServiceModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('האם את בטוחה שברצונך למחוק שירות זה? לקוחות לא יוכלו להזמין אותו יותר.')) return;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) showToast('לא ניתן למחוק את השירות.', 'error');
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
    const daysWithSchedules = dailySchedules.filter(ds => ds.date !== '2035-12-31' && (ds.start_time !== '09:00' || ds.end_time !== '16:00')).map(ds => ds.date);
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
  const futureSchedulesList = useMemo(() => dailySchedules.filter(ds => ds.date !== '2035-12-31' && ds.date >= todayStr && (ds.start_time !== '09:00' || ds.end_time !== '16:00')).sort((a,b) => a.date.localeCompare(b.date)), [dailySchedules, todayStr]);
  const futureBreaksList = useMemo(() => blockedTimeSlots.filter(bts => bts.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)), [blockedTimeSlots, todayStr]);

  // Read-only derivation for the live status banner. Reuses existing state only.
  const todayStatus = useMemo(() => {
    const closed = blockedDates.some(bd => bd.date === todayStr);
    const schedule = dailySchedules.find(ds => ds.date === todayStr);
    const opensAt = schedule ? schedule.start_time.slice(0, 5) : '09:00';
    const closesAt = schedule ? schedule.end_time.slice(0, 5) : '16:00';
    const openNow =
      !closed && nowMinutes >= timeToMinutes(opensAt) && nowMinutes < timeToMinutes(closesAt);
    const onBreak =
      openNow &&
      blockedTimeSlots.some(
        bts =>
          bts.date === todayStr &&
          nowMinutes >= timeToMinutes(bts.start_time) &&
          nowMinutes < timeToMinutes(bts.end_time)
      );
    const upcoming = bookings
      .filter(
        b =>
          b.date === todayStr &&
          b.status === 'confirmed' &&
          b.customer_phone !== '0508917748' &&
          timeToMinutes(b.start_time) >= nowMinutes
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return { closed, opensAt, closesAt, openNow, onBreak, nextBooking: upcoming[0] ?? null };
  }, [blockedDates, dailySchedules, blockedTimeSlots, bookings, todayStr, nowMinutes]);

  // Next Up Spotlight — today's next confirmed booking relative to now (additive UI only).
  const nextUpSpotlight = useMemo(() => {
    const todayConfirmed = bookings
      .filter(
        (b) =>
          b.date === todayStr &&
          b.status === 'confirmed' &&
          b.customer_phone !== '0508917748'
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (todayConfirmed.length === 0) {
      return { state: 'empty' as const, booking: null as Booking | null, minutesUntil: 0 };
    }

    const live = todayConfirmed.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return nowMinutes >= start && nowMinutes < end;
    });
    if (live) {
      return { state: 'live' as const, booking: live, minutesUntil: 0 };
    }

    const upcoming = todayConfirmed.find((b) => timeToMinutes(b.start_time) >= nowMinutes);
    if (upcoming) {
      return {
        state: 'upcoming' as const,
        booking: upcoming,
        minutesUntil: timeToMinutes(upcoming.start_time) - nowMinutes,
      };
    }

    return { state: 'done' as const, booking: null as Booking | null, minutesUntil: 0 };
  }, [bookings, todayStr, nowMinutes]);

  // Pure client analytics — maps confirmed bookings to service prices (no schema changes).
  const analytics = useMemo(() => {
    const priceById = new Map<string, number>();
    const priceByTitle = new Map<string, number>();
    dbServices.forEach((s) => {
      const p = parsePrice(s.price);
      if (s.id) priceById.set(String(s.id), p);
      if (s.title) priceByTitle.set(String(s.title).trim(), p);
    });

    const priceFor = (b: Booking) => {
      if (b.service_id && priceById.has(String(b.service_id))) return priceById.get(String(b.service_id))!;
      if (b.service_title && priceByTitle.has(b.service_title.trim())) return priceByTitle.get(b.service_title.trim())!;
      return 0;
    };

    const durationFor = (b: Booking) => {
      if (typeof b.service_duration === 'number' && b.service_duration > 0) return b.service_duration;
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return Math.max(0, end - start);
    };

    const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
    const confirmed = bookings.filter(
      (b) => b.status === 'confirmed' && b.customer_phone !== '0508917748'
    );

    let todayRevenue = 0;
    let monthRevenue = 0;
    let todayWorkMinutes = 0;
    let completedToday = 0;
    const serviceCounts: Record<string, number> = {};

    confirmed.forEach((b) => {
      const price = priceFor(b);
      if (b.date === todayStr) {
        todayRevenue += price;
        todayWorkMinutes += durationFor(b);
        if (timeToMinutes(b.end_time) <= nowMinutes) completedToday += 1;
      }
      if (b.date.startsWith(monthPrefix)) {
        monthRevenue += price;
      }
      const title = (b.service_title || '').trim() || 'לא מוגדר';
      serviceCounts[title] = (serviceCounts[title] || 0) + 1;
    });

    let topService = '—';
    let topCount = 0;
    Object.entries(serviceCounts).forEach(([title, count]) => {
      if (count > topCount) {
        topCount = count;
        topService = title;
      }
    });

    return { todayRevenue, monthRevenue, todayWorkMinutes, topService, completedToday };
  }, [bookings, dbServices, todayStr, nowMinutes]);

  useEffect(() => {
    if (!isAnalyticsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAnalyticsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isAnalyticsOpen]);

  // Dynamic free slots for Smart Manual Booking modal
  const manualAvailableSlots = useMemo(() => {
    const dateStr = manualBookingForm.date;
    const service = dbServices.find((s) => s.id === manualBookingForm.serviceId);
    if (!dateStr || !service) return [] as string[];

    if (blockedDates.some((bd) => bd.date === dateStr)) return [] as string[];

    const duration = Number(service.duration_minutes) || 30;
    const schedule = dailySchedules.find((ds) => ds.date === dateStr && ds.date !== '2035-12-31');
    const workStart = schedule ? timeToMinutes(schedule.start_time) : 9 * 60;
    const workEnd = schedule ? timeToMinutes(schedule.end_time) : 16 * 60;

    const dayBreaks = blockedTimeSlots
      .filter((bts) => bts.date === dateStr)
      .map((bts) => ({ start: timeToMinutes(bts.start_time), end: timeToMinutes(bts.end_time) }));

    const dayBookings = bookings
      .filter(
        (b) =>
          b.date === dateStr &&
          (b.status === 'confirmed' || b.status === 'pending') &&
          b.customer_phone !== '0508917748'
      )
      .map((b) => ({ start: timeToMinutes(b.start_time), end: timeToMinutes(b.end_time) }));

    const slots: string[] = [];
    const isToday = dateStr === todayStr;
    for (let pos = workStart; pos + duration <= workEnd; pos += 30) {
      if (isToday && pos <= nowMinutes) continue;
      const slotEnd = pos + duration;
      const overlapsBreak = dayBreaks.some((br) => pos < br.end && slotEnd > br.start);
      const overlapsBooking = dayBookings.some((bk) => pos < bk.end && slotEnd > bk.start);
      if (!overlapsBreak && !overlapsBooking) slots.push(minutesToTime(pos));
    }
    return slots;
  }, [
    manualBookingForm.date,
    manualBookingForm.serviceId,
    dbServices,
    blockedDates,
    dailySchedules,
    blockedTimeSlots,
    bookings,
    todayStr,
    nowMinutes,
  ]);

  // Clear selected start time if it becomes unavailable after date/service change
  useEffect(() => {
    if (
      manualBookingForm.startTime &&
      !manualAvailableSlots.includes(manualBookingForm.startTime)
    ) {
      setManualBookingForm((prev) => ({ ...prev, startTime: '' }));
    }
  }, [manualAvailableSlots, manualBookingForm.startTime]);

  if (checkingAuth) return null;
  if (!session) return <LoginForm onLoginSuccess={() => fetchData()} />;

  const selectedDateStr = toLocalDateString(selectedDate);
  const isSelectedToday = selectedDateStr === todayStr;

  const dayPickerModifiers = { hasBooking: bookingDateObjects, blocked: blockedDateObjects, partial: partialDateObjects, past: pastDates };
  const dayPickerModifiersClassNames = { hasBooking: 'rdp-day_hasBooking', blocked: 'rdp-day_blocked', partial: 'rdp-day_partial', past: 'rdp-day_past' };

  const NAV_TABS: { id: AdminTab; label: string; icon: any; badge?: number }[] = [
    { id: 'daily', label: 'לו״ז', icon: Clock },
    { id: 'approvals', label: 'בקשות', icon: Bell, badge: pendingApprovals.length },
    { id: 'calendar', label: 'ניהול', icon: CalendarIcon },
    { id: 'customers', label: 'לקוחות', icon: Users },
    { id: 'services', label: 'שירותים', icon: Sparkles },
    { id: 'activity', label: 'פעילות', icon: History },
  ];

  const calendarLegend = (
    <div className={`mt-3 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 border-t ${HAIRLINE} pt-3`}>
      {[
        { color: GOLD, label: 'תורים' },
        { color: '#fca5a5', label: 'יום סגור' },
        { color: '#fcd34d', label: 'מותאם' },
      ].map(item => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
          <span className="text-[8.5px] font-medium tracking-tight text-slate-400">{item.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF6] pb-24 text-right font-sans text-slate-800 selection:bg-[#c9a961]/15">

      <style jsx global>{`
        @keyframes adarFadeUp {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes adarPop {
          from { opacity: 0; transform: scale(0.965); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes adarToastIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.96); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes adarSheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .anim-fade-up { animation: adarFadeUp .38s cubic-bezier(.22,1,.36,1) both; }
        .anim-pop     { animation: adarPop .24s cubic-bezier(.22,1,.36,1) both; }
        .anim-toast   { animation: adarToastIn .3s cubic-bezier(.22,1,.36,1) both; }
        .anim-sheet   { animation: adarSheetUp .34s cubic-bezier(.22,1,.36,1) both; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* ---- react-day-picker v9 ---- */
        .rdp-root {
          --rdp-accent-color: ${GOLD};
          --rdp-accent-background-color: #faf6ec;
          --rdp-today-color: ${GOLD_DEEP};
          --rdp-day-height: 34px;
          --rdp-day-width: 34px;
          --rdp-day_button-height: 32px;
          --rdp-day_button-width: 32px;
          --rdp-day_button-border-radius: 9999px;
          --rdp-day_button-border: 1px solid transparent;
          --rdp-selected-border: none;
          --rdp-nav_button-height: 1.75rem;
          --rdp-nav_button-width: 1.75rem;
          --rdp-outside-opacity: 0.3;
          margin: 0 auto;
          font-feature-settings: 'tnum';
        }
        .rdp-months { justify-content: center; }
        .rdp-month_caption {
          font-weight: 600;
          font-size: 0.8125rem;
          letter-spacing: -0.01em;
          color: #0f172a;
        }
        .rdp-weekday {
          font-size: 0.5625rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #cbd5e1;
          padding: 0.3rem 0;
        }
        .rdp-day_button {
          position: relative;
          font-weight: 500;
          font-size: 0.75rem;
          letter-spacing: -0.01em;
          transition: background .2s ease, color .2s ease, box-shadow .2s ease;
        }
        .rdp-selected .rdp-day_button {
          background: ${GOLD};
          color: #fff;
          font-weight: 600;
          box-shadow: 0 4px 14px -2px rgba(201,169,97,.5);
        }
        .rdp-today:not(.rdp-selected) .rdp-day_button {
          color: ${GOLD_DEEP};
          font-weight: 700;
        }
        /* Radiant gold booking dot, kept clear of the circular day fill. */
        .rdp-day_hasBooking:not(.rdp-selected) .rdp-day_button::after {
          content: '';
          position: absolute;
          bottom: 1px;
          left: 50%;
          transform: translateX(-50%);
          width: 4.5px;
          height: 4.5px;
          background: radial-gradient(circle, #e0c98a 0%, ${GOLD} 60%, ${GOLD_DEEP} 100%);
          border-radius: 9999px;
          box-shadow: 0 0 0 1.5px rgba(201,169,97,.18), 0 0 6px 1px rgba(201,169,97,.55);
        }
        /* Pastel block indicators. */
        .rdp-day_blocked:not(.rdp-selected) .rdp-day_button {
          background: #fee2e2;
          color: #ef4444;
          box-shadow: inset 0 0 0 1px rgba(239,68,68,.12);
        }
        .rdp-day_partial:not(.rdp-selected) .rdp-day_button {
          background: #fef3c7;
          color: #d97706;
          box-shadow: inset 0 0 0 1px rgba(217,119,6,.12);
        }
        .rdp-day_past:not(.rdp-selected) .rdp-day_button {
          color: #cbd5e1;
        }
        .rdp-chevron { fill: ${GOLD}; }
      `}</style>

      {/* ---------------- Toast ---------------- */}
      {toast && (
        <div key={toast.id} className="anim-toast pointer-events-none fixed inset-x-0 top-3 z-[300] flex justify-center px-4">
          <div
            className={`pointer-events-auto flex max-w-[22rem] items-center gap-2.5 rounded-[1.25rem] border px-4 py-3 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.2)] backdrop-blur-2xl ${
              toast.tone === 'error'
                ? 'border-red-900/[0.06] bg-red-50/90 text-red-700'
                : 'border-emerald-900/[0.06] bg-emerald-50/90 text-emerald-800'
            }`}
          >
            {toast.tone === 'error' ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCheck size={15} className="shrink-0" />}
            <p className="whitespace-pre-line text-[12px] font-medium leading-snug tracking-tight">{toast.message}</p>
          </div>
        </div>
      )}

      {/* ---------------- Sticky header + KPI strip ---------------- */}
      <header className={`sticky top-0 z-[100] border-b ${HAIRLINE} bg-[#FDFBF6]/80 backdrop-blur-2xl`}>
        <div className="mx-auto max-w-3xl px-3.5 pb-2.5 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.75rem] bg-slate-900 text-white shadow-[0_2px_10px_-2px_rgba(15,23,42,0.4)]">
                <Activity size={15} />
              </div>
              <div className="min-w-0">
                <h1 className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-900">Console</h1>
                <p className="mt-0.5 truncate text-[9px] font-medium tracking-tight text-slate-400">
                  <span className="text-[#c9a961]">אדר קוסמטיקס</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="tabular-nums">{formatHeWeekday(todayStr)} {formatHeDate(todayStr)}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAnalyticsOpen(true)}
                aria-label="תובנות והכנסות"
                className="flex h-9 items-center gap-1 rounded-full border border-[#c9a961]/25 bg-[#c9a961]/10 px-2.5 text-[10px] font-semibold tracking-tight text-[#b8964f] transition-all active:scale-95"
              >
                <BarChart3 size={12} />
                <span className="tabular-nums">₪</span>
                תובנות
              </button>
              <button
                type="button"
                onClick={openManualBookingModal}
                aria-label="תור חדש"
                className="flex h-9 items-center gap-1 rounded-full bg-slate-900 px-2.5 text-[10px] font-semibold tracking-tight text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.4)] transition-all active:scale-95"
              >
                <Plus size={13} strokeWidth={2.5} />
                תור חדש
              </button>
              <button
                onClick={() => setActiveTab('approvals')}
                aria-label={`בקשות תורים (${pendingApprovals.length})`}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-all active:scale-90 ${
                  pendingApprovals.length > 0
                    ? 'border-amber-600/10 bg-amber-50/80 text-amber-500'
                    : 'border-slate-900/[0.05] bg-white/70 text-slate-300'
                }`}
              >
                <Bell size={15} />
                {pendingApprovals.length > 0 && (
                  <span className="absolute -left-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold leading-none tabular-nums text-white ring-2 ring-[#FDFBF6]">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                aria-label="התנתקות"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-900/[0.05] bg-white/70 text-slate-300 transition-all hover:text-red-500 active:scale-90"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          {/* Two-tier bento: live operational banner over the metric grid. */}
          <div className={`mt-2.5 overflow-hidden ${CARD}`}>
            <div className={`flex items-center justify-between gap-2 border-b ${HAIRLINE} px-3 py-2.5`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                  {todayStatus.openNow && !todayStatus.onBreak && (
                    <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400/70" />
                  )}
                  <span
                    className={`h-2 w-2 rounded-full ${
                      todayStatus.closed
                        ? 'bg-red-400'
                        : todayStatus.onBreak
                          ? 'bg-amber-400'
                          : todayStatus.openNow
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                    }`}
                  />
                </span>
                <p className="min-w-0 truncate text-[11.5px] font-semibold tracking-tight text-slate-700">
                  {todayStatus.closed
                    ? 'היום סגור'
                    : todayStatus.onBreak
                      ? 'בהפסקה'
                      : todayStatus.openNow
                        ? 'פתוח עכשיו'
                        : 'מחוץ לשעות הפעילות'}
                  <span className="mr-1.5 font-normal tabular-nums text-slate-400">
                    {todayStatus.opensAt}–{todayStatus.closesAt}
                  </span>
                </p>
              </div>

              {todayStatus.nextBooking ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[9px] font-medium tracking-tight text-slate-400">הבא</span>
                  <span className="text-[12px] font-semibold leading-none tracking-tight tabular-nums text-[#b8964f]">
                    {todayStatus.nextBooking.start_time.slice(0, 5)}
                  </span>
                </div>
              ) : (
                <span className="shrink-0 text-[9px] font-medium tracking-tight text-slate-300">אין תורים נוספים</span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-1.5">
              <MetricTile
                label="היום"
                value={bookings.filter(b => b.date === todayStr && b.status === 'confirmed').length}
                icon={Clock}
              />
              <MetricTile
                label="ממתינות"
                value={pendingApprovals.length}
                icon={Bell}
                tone={pendingApprovals.length > 0 ? 'amber' : 'slate'}
                onClick={() => setActiveTab('approvals')}
              />
              <MetricTile
                label="חסימות"
                value={futureBlockedList.length}
                icon={XCircle}
                tone={futureBlockedList.length > 0 ? 'red' : 'slate'}
              />
              <MetricTile label="לקוחות" value={customerBaseStats.totalActiveCount} icon={Users} tone="gold" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-3 max-w-3xl space-y-3 px-3.5">

        {/* ======================= APPROVALS ======================= */}
        {activeTab === 'approvals' && (
          <div className="anim-fade-up space-y-3">
            <section className={`${CARD} p-4`}>
              <SectionHeader
                icon={Bell}
                title={`בקשות ממתינות לאישור (${pendingApprovals.length})`}
                description="תורים אלו תופסים את השעה ביומן של הלקוחות, אך לא יירשמו ביומן של אדר עד שלא יאושרו סופית."
                accent="#f59e0b"
              />

              {pendingApprovals.length === 0 ? (
                <EmptyState icon={Inbox} title="הכל מעודכן" description="אין בקשות תורים הממתינות לאישור כרגע." />
              ) : (
                <div className="space-y-2">
                  {pendingApprovals.map((app, index) => (
                    <div
                      key={app.id}
                      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                      className="anim-fade-up rounded-3xl border border-amber-400/40 bg-white/85 p-3.5 text-right shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="min-w-0 truncate text-[16px] font-semibold not-italic leading-tight tracking-tight text-slate-900">{app.customer_name}</h4>
                            <StatusChip status="pending" />
                          </div>
                          <p className="mt-1 truncate text-[11px] font-medium not-italic leading-tight tracking-tight text-[#b8964f]">{app.service_title}</p>
                        </div>
                        <div className={`shrink-0 border-r ${HAIRLINE} pr-3 text-center`}>
                          <span className="block text-[19px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">{app.start_time.slice(0,5)}</span>
                          <span className="mt-1 block text-[9px] font-medium tracking-tight tabular-nums text-slate-400">
                            {formatHeWeekday(app.date)} · {formatHeDate(app.date)}
                          </span>
                        </div>
                      </div>

                      <div className={`mt-3 flex items-center gap-1.5 border-t ${HAIRLINE} pt-3`}>
                        <button
                          onClick={() => handleApproveBooking(app)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-600 py-2.5 text-[11.5px] font-semibold tracking-tight text-white shadow-[0_2px_10px_-2px_rgba(5,150,105,0.5)] transition-all active:scale-95"
                        >
                          <CheckCircle2 size={13} /> אישור ושליחת SMS
                        </button>
                        <button
                          onClick={() => handleRejectBooking(app)}
                          aria-label="דחיית הבקשה"
                          className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-red-50/80 px-4 py-2.5 text-[11.5px] font-semibold tracking-tight text-red-500 ring-1 ring-inset ring-red-600/10 transition-all active:scale-95"
                        >
                          <X size={13} /> דחייה
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ======================= DAILY ======================= */}
        {activeTab === 'daily' && (
          <div className="anim-fade-up space-y-3">
            {/* Next Up Spotlight — כרטיס התור הקרוב */}
            <div className="mb-0 rounded-2xl border border-slate-900/[0.06] bg-gradient-to-r from-white/90 via-white/80 to-[#fbf8f2]/70 p-3 shadow-sm backdrop-blur-xl">
              {nextUpSpotlight.booking ? (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {nextUpSpotlight.state === 'live' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold leading-none tracking-tight text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          מתקיים כעת
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#c9a961]/12 px-2 py-0.5 text-[9px] font-semibold leading-none tracking-tight tabular-nums text-[#b8964f] ring-1 ring-inset ring-[#c9a961]/20">
                          {nextUpSpotlight.minutesUntil > 0
                            ? `התור הבא בעוד ${nextUpSpotlight.minutesUntil} דק'`
                            : `התור הבא · ${nextUpSpotlight.booking.start_time.slice(0, 5)}`}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold tabular-nums tracking-tight text-slate-400">
                        {nextUpSpotlight.booking.start_time.slice(0, 5)}–{nextUpSpotlight.booking.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[14px] font-semibold not-italic leading-tight tracking-tight text-slate-900">
                      {nextUpSpotlight.booking.customer_name}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium not-italic leading-tight tracking-tight text-[#c9a961]">
                      {nextUpSpotlight.booking.service_title}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`tel:${nextUpSpotlight.booking.customer_phone}`}
                      aria-label="חיוג ללקוחה"
                      title="חיוג"
                      className={`${ACTION_CIRCLE} h-8 w-8 bg-slate-100/80 text-slate-500 ring-1 ring-inset ring-slate-600/[0.06]`}
                    >
                      <Phone size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const phone = nextUpSpotlight.booking!.customer_phone.replace(/^0/, '');
                        const text = encodeURIComponent(
                          `היי ${nextUpSpotlight.booking!.customer_name}, מחכה לך בקליניקה 💕`
                        );
                        window.open(`https://wa.me/972${phone}?text=${text}`);
                      }}
                      aria-label="וואטסאפ ללקוחה"
                      title="וואטסאפ"
                      className={`${ACTION_CIRCLE} h-8 w-8 bg-green-50/90 text-green-600 ring-1 ring-inset ring-green-600/10`}
                    >
                      <MessageCircle size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-1 text-center">
                  <Sparkles size={12} className="shrink-0 text-[#c9a961]" />
                  <p className="text-[12px] font-medium tracking-tight text-slate-400">
                    הסתיימו התורים להיום ✨
                  </p>
                </div>
              )}
            </div>

            {/* Day navigator */}
            <div className={`${CARD} flex items-center justify-between gap-1.5 p-2`}>
              <button
                onClick={() => changeDay(-1)}
                aria-label="היום הקודם"
                className={`${ACTION_CIRCLE} h-9 w-9 bg-slate-100/60 text-slate-400`}
              >
                <ChevronRight size={17} />
              </button>

              <button
                onClick={() => setIsQuickCalendarOpen(true)}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-2 py-1.5 transition-all active:scale-95 active:bg-slate-100/50"
              >
                <span className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-900">{formatHeDate(selectedDateStr)}</span>
                <span className="truncate text-[10px] font-medium tracking-tight text-slate-400">
                  {formatHeWeekday(selectedDateStr)}
                </span>
                {isSelectedToday && <Badge tone="gold">היום</Badge>}
                <Badge tone="slate">{dailyBookings.length}</Badge>
              </button>

              {!isSelectedToday && (
                <button
                  onClick={() => setSelectedDate(new Date())}
                  aria-label="חזרה להיום"
                  className={`${ACTION_CIRCLE} h-9 w-9 bg-[#c9a961]/10 text-[#b8964f]`}
                >
                  <CalendarDays size={15} />
                </button>
              )}

              <button
                onClick={() => changeDay(1)}
                aria-label="היום הבא"
                className={`${ACTION_CIRCLE} h-9 w-9 bg-slate-100/60 text-slate-400`}
              >
                <ChevronLeft size={17} />
              </button>
            </div>

            {/* Timeline */}
            <div className={`${CARD} min-h-[300px] p-3`}>
              {isFullBlocked ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50/70 text-red-400 ring-1 ring-inset ring-red-600/10">
                    <Lock size={22} />
                  </div>
                  <div>
                    <p className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-600">היום חסום במלואו</p>
                    <p className="mt-1 text-[10.5px] font-normal tracking-tight text-slate-400">לקוחות אינן יכולות לקבוע תורים בתאריך זה.</p>
                  </div>
                </div>
              ) : (
                /* Continuous vertical time track: one hairline running behind every slot. */
                <div className="relative space-y-1 before:absolute before:inset-y-1.5 before:right-9 before:w-px before:bg-slate-900/[0.06] before:content-['']">
                  {timeSlots.map(time => {
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

                    const rowEndMinutes = booking ? timeToMinutes(booking.end_time) : currentMinutes + 30;
                    const showNow = isSelectedToday && nowMinutes >= currentMinutes && nowMinutes < rowEndMinutes;

                    /* Real-time marker: radiant gold dot seated on the time track. */
                    const nowIndicator = showNow ? (
                      <div className="relative z-10 mb-1 flex items-center gap-2" aria-hidden="true">
                        <div className="w-8 shrink-0 text-[9.5px] font-semibold leading-none tracking-tight tabular-nums text-[#b8964f]">
                          {minutesToTime(nowMinutes)}
                        </div>
                        <div className="flex flex-1 items-center gap-1.5">
                          <span className="-mr-2 h-2 w-2 shrink-0 rounded-full bg-[#c9a961] shadow-[0_0_0_3px_rgba(201,169,97,0.18),0_0_10px_2px_rgba(201,169,97,0.45)]" />
                          <span className="h-px flex-1 bg-gradient-to-l from-[#c9a961]/70 via-[#c9a961]/25 to-transparent" />
                          <span className="text-[8.5px] font-semibold tracking-tight text-[#b8964f]">עכשיו</span>
                        </div>
                      </div>
                    ) : null;

                    // Closed slot — inset textured well with a mini status chip.
                    if (isOutsideWorkHours && !booking) {
                      return (
                        <div key={time} className="relative">
                          {nowIndicator}
                          <div className="flex items-center gap-2">
                            <div className="w-8 shrink-0 text-[9.5px] font-medium leading-none tracking-tight tabular-nums text-slate-300">{time}</div>
                            <div className={`flex h-8 flex-1 items-center justify-between px-3 ${INSET}`}>
                              <span className="flex items-center gap-1.5 text-[9.5px] font-medium tracking-tight text-slate-400">
                                <MoonStar size={10} /> מחוץ לשעות הפעילות
                              </span>
                              <Badge tone="slate">סגור</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={time} className="relative">
                        {nowIndicator}
                        <div className="flex items-stretch gap-2">
                          <div className="w-8 shrink-0 pt-3 text-[9.5px] font-medium leading-none tracking-tight tabular-nums text-slate-400">{time}</div>
                          <div className="min-w-0 flex-1">
                            {booking ? (
                              /* Boarding-pass ticket: time stub, perforation, then details. */
                              <div
                                className={`relative flex items-stretch overflow-hidden rounded-2xl border bg-white/85 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ${
                                  booking.status === 'pending' ? 'border-amber-400/40' : 'border-[#c9a961]/30'
                                }`}
                              >
                                <div
                                  className={`flex w-[4.5rem] shrink-0 flex-col items-center justify-center px-1.5 py-3 ${
                                    booking.status === 'pending' ? 'bg-amber-400/[0.07]' : 'bg-[#c9a961]/[0.07]'
                                  }`}
                                >
                                  <span className="text-[18px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                                    {booking.start_time.slice(0,5)}
                                  </span>
                                  <span className="mt-1 text-[9.5px] font-medium leading-none tracking-tight tabular-nums text-slate-400">
                                    {booking.end_time.slice(0,5)}
                                  </span>
                                  <span className="mt-1.5 text-[8.5px] font-medium leading-none tracking-tight tabular-nums text-[#b8964f]">
                                    {timeToMinutes(booking.end_time) - timeToMinutes(booking.start_time)} דק'
                                  </span>
                                </div>

                                {/* Perforated seam with punched notches. */}
                                <div
                                  className={`relative w-0 border-r border-dashed ${
                                    booking.status === 'pending' ? 'border-amber-400/40' : 'border-[#c9a961]/30'
                                  }`}
                                >
                                  <span className="absolute -right-[0.3125rem] -top-[0.3125rem] h-2.5 w-2.5 rounded-full bg-[#FDFBF6]" />
                                  <span className="absolute -bottom-[0.3125rem] -right-[0.3125rem] h-2.5 w-2.5 rounded-full bg-[#FDFBF6]" />
                                </div>

                                <div className="min-w-0 flex-1 px-3 py-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="min-w-0 flex-1 truncate text-[16px] font-semibold not-italic leading-tight tracking-tight text-slate-900">
                                      {booking.customer_name}
                                    </h4>
                                    <StatusChip status={booking.status} />
                                  </div>
                                  <p className="mt-0.5 truncate text-[11px] font-medium not-italic leading-tight tracking-tight text-[#b8964f]">{booking.service_title}</p>

                                  <div className={`mt-2 flex gap-1.5 border-t ${HAIRLINE} pt-2`}>
                                    {booking.status === 'pending' && (
                                      <button
                                        onClick={() => handleApproveBooking(booking)}
                                        className={`${ACTION_CIRCLE} bg-emerald-50/80 text-emerald-600 ring-1 ring-inset ring-emerald-600/10`}
                                        aria-label="אישור מהיר"
                                        title="אישור מהיר"
                                      >
                                        <CheckCircle2 size={13} />
                                      </button>
                                    )}
                                    <a
                                      href={`tel:${booking.customer_phone}`}
                                      className={`${ACTION_CIRCLE} bg-slate-100/70 text-slate-500 ring-1 ring-inset ring-slate-600/[0.06]`}
                                      aria-label="חיוג ללקוחה"
                                      title="חיוג"
                                    >
                                      <Phone size={13} />
                                    </a>
                                    <button
                                      onClick={() => window.open(`https://wa.me/972${booking.customer_phone.replace(/^0/, '')}`)}
                                      className={`${ACTION_CIRCLE} bg-green-50/80 text-green-600 ring-1 ring-inset ring-green-600/10`}
                                      aria-label="וואטסאפ ללקוחה"
                                      title="וואטסאפ"
                                    >
                                      <MessageCircle size={13} />
                                    </button>
                                    <button
                                      onClick={async () => { if (confirm('ביטול תור?')) { await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id); fetchData(); } }}
                                      className={`${ACTION_CIRCLE} bg-red-50/80 text-red-400 ring-1 ring-inset ring-red-600/10`}
                                      aria-label="ביטול תור"
                                      title="ביטול תור"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : isBreak ? (
                              <div className={`flex h-11 items-center justify-between px-3 ${INSET} border-amber-300/50 bg-amber-400/[0.06]`}>
                                <span className="flex items-center gap-1.5 text-[10.5px] font-medium tracking-tight text-amber-700/80">
                                  <Hand size={11} /> הפסקה מוגדרת
                                </span>
                                <Badge tone="amber">הפסקה</Badge>
                              </div>
                            ) : (
                              <div className="flex h-11 items-center rounded-2xl border border-dashed border-slate-200 px-3 text-[10.5px] font-medium tracking-tight text-slate-300 transition-colors hover:border-[#c9a961]/40 hover:text-[#b8964f]">
                                פנוי
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= CALENDAR ======================= */}
        {activeTab === 'calendar' && (
          <div className="anim-fade-up space-y-3">
            <div className="flex gap-1.5">
              <MiniStat label="ימים סגורים" value={futureBlockedList.length} />
              <MiniStat label="הפסקות" value={futureBreaksList.length} />
              <MiniStat label="מותאמים" value={futureSchedulesList.length} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <section className={`${CARD} p-4`}>
                <SectionHeader icon={CalendarIcon} title="ניהול יומן" description="בחרי תאריך כדי לערוך את מסגרת היום, ההפסקות והחסימות." />
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  modifiers={dayPickerModifiers}
                  modifiersClassNames={dayPickerModifiersClassNames}
                />
                {calendarLegend}
                <button
                  onClick={async () => {
                    const dStr = toLocalDateString(selectedDate);
                    const existing = blockedDates.find(d => d.date === dStr);
                    if (existing) await supabase.from('blocked_dates').delete().eq('date', dStr);
                    else await supabase.from('blocked_dates').insert([{ date: dStr }]);
                    fetchData();
                  }}
                  className={`mt-3 w-full rounded-2xl py-3 text-[12px] font-semibold tracking-tight ring-1 ring-inset transition-all active:scale-95 ${
                    isFullBlocked
                      ? 'bg-emerald-50/80 text-emerald-600 ring-emerald-600/10'
                      : 'bg-red-50/80 text-red-500 ring-red-600/10'
                  }`}
                >
                  סגירה / פתיחה של יום מלא
                </button>
              </section>

              <div className="space-y-3">
                <section className={`${CARD} p-4`}>
                  <SectionHeader
                    icon={Sliders}
                    title="מסגרת יום מותאמת"
                    description="הגדרת פתיחה וסגירה. ברירת מחדל: 09:00 - 16:00."
                    accent="#f59e0b"
                  />
                  <div className="flex gap-2">
                    <input type="time" aria-label="שעת פתיחה" value={customHoursStartTime} onChange={e => setCustomHoursStartTime(e.target.value)} className={INPUT} />
                    <input type="time" aria-label="שעת סגירה" value={customHoursEndTime} onChange={e => setCustomHoursEndTime(e.target.value)} className={INPUT} />
                  </div>
                  <button
                    onClick={async () => { 
                      await supabase.from('daily_schedules').upsert({ date: toLocalDateString(selectedDate), start_time: customHoursStartTime, end_time: customHoursEndTime }); 
                      fetchData(); 
                      showToast('מסגרת העבודה עודכנה בהצלחה! 🎉');
                    }}
                    className={`mt-2 ${BTN_DARK}`}
                  >
                    עדכון מסגרת עבודה
                  </button>
                  {dailySchedules.some(ds => ds.date === toLocalDateString(selectedDate)) && (
                    <button
                      onClick={async () => { 
                        await supabase.from('daily_schedules').delete().eq('date', toLocalDateString(selectedDate)); 
                        fetchData(); 
                        showToast('היום הוחזר לשעות ברירת המחדל (09:00-16:00) בהצלחה! ✨');
                      }}
                      className="mt-1.5 w-full rounded-2xl bg-red-50/80 py-2.5 text-[11.5px] font-medium tracking-tight text-red-500 ring-1 ring-inset ring-red-600/10 transition-all active:scale-95"
                    >
                      חזרה לשעות ברירת מחדל (09:00-16:00)
                    </button>
                  )}
                </section>

                <section className={`${CARD} p-4`}>
                  <SectionHeader icon={Hand} title="הוספת הפסקה" description="לקוחות לא יוכלו קבוע תורים בשעות אלו." accent="#f59e0b" />
                  <div className="flex gap-2">
                    <input type="time" aria-label="תחילת הפסקה" value={breakStartTime} onChange={e => setBreakStartTime(e.target.value)} className={INPUT} />
                    <input type="time" aria-label="סיום הפסקה" value={breakEndTime} onChange={e => setBreakEndTime(e.target.value)} className={INPUT} />
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from('blocked_time_slots').insert({ date: toLocalDateString(selectedDate), start_time: breakStartTime, end_time: breakEndTime });
                      fetchData();
                    }}
                    className={`mt-2 ${BTN_GOLD}`}
                  >
                    הוסף הפסקה ביום זה
                  </button>
                </section>
              </div>
            </div>

            <section className={`${CARD} p-4`}>
              <SectionHeader
                icon={Eye}
                title="טווח פתיחת יומן ללקוחות"
                description="הגדירי עד איזה תאריך היומן יהיה פתוח לקביעת תורים. כל תאריך מעבר ליום שנבחר ייחסם אוטומטית ללקוחות."
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  aria-label="תאריך סגירת היומן"
                  min={todayStr}
                  value={maxCalendarOpenDate}
                  onChange={e => setMaxCalendarOpenDate(e.target.value)}
                  className={`${INPUT} flex-1`}
                />
                <button
                  onClick={handleUpdateMaxCalendarDate}
                  disabled={savingMaxDate}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-5 py-2.5 text-[12px] font-semibold tracking-tight text-white shadow-[0_2px_10px_-2px_rgba(15,23,42,0.35)] transition-all active:scale-95 disabled:opacity-60"
                >
                  {savingMaxDate && <Loader2 size={13} className="animate-spin" />}
                  {savingMaxDate ? 'מעדכן...' : 'עדכון'}
                </button>
              </div>
            </section>

            <section className={`${CARD} p-4`}>
              <SectionHeader icon={AlertTriangle} title="פירוט חסימות והפסקות" accent="#475569" />
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto pl-0.5">
                {[...futureBlockedList, ...futureSchedulesList, ...futureBreaksList].length === 0 && (
                  <EmptyState icon={CalendarDays} title="היומן פנוי" description="אין חסימות או הפסקות עתידיות." />
                )}

                {futureBlockedList.map(bd => (
                  <div key={bd.date} className="flex items-center justify-between gap-2 rounded-2xl bg-red-50/50 px-3 py-2.5 ring-1 ring-inset ring-red-600/[0.08]">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="text-[12px] font-semibold tracking-tight tabular-nums text-red-700">{formatHeDate(bd.date)}</span>
                      <span className="truncate text-[10px] font-normal tracking-tight text-red-400">יום סגור מלא</span>
                    </span>
                    <button
                      onClick={async () => { await supabase.from('blocked_dates').delete().eq('date', bd.date); fetchData(); }}
                      aria-label="הסרת חסימה"
                      className={`${ACTION_CIRCLE} h-6 w-6 bg-red-100/60 text-red-400`}
                    >
                      <X size={12}/>
                    </button>
                  </div>
                ))}

                {futureSchedulesList.map(ds => (
                  <div key={ds.date} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-100/40 px-3 py-2.5 ring-1 ring-inset ring-slate-600/[0.06]">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="text-[12px] font-semibold tracking-tight tabular-nums text-slate-700">{formatHeDate(ds.date)}</span>
                      <span className="truncate text-[10px] font-normal tracking-tight tabular-nums text-slate-400">
                        מסגרת {ds.start_time.slice(0,5)}–{ds.end_time.slice(0,5)}
                      </span>
                    </span>
                    <button
                      onClick={async () => { await supabase.from('daily_schedules').delete().eq('date', ds.date); fetchData(); }}
                      aria-label="הסרת מסגרת מותאמת"
                      className={`${ACTION_CIRCLE} h-6 w-6 bg-slate-200/60 text-slate-400`}
                    >
                      <X size={12}/>
                    </button>
                  </div>
                ))}

                {futureBreaksList.map(bts => (
                  <div key={bts.id} className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50/50 px-3 py-2.5 ring-1 ring-inset ring-amber-600/[0.08]">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span className="text-[12px] font-semibold tracking-tight tabular-nums text-amber-700">{formatHeDate(bts.date)}</span>
                      <span className="truncate text-[10px] font-normal tracking-tight tabular-nums text-amber-500">
                        הפסקה {bts.start_time.slice(0,5)}–{bts.end_time.slice(0,5)}
                      </span>
                    </span>
                    <button
                      onClick={async () => { await supabase.from('blocked_time_slots').delete().eq('id', bts.id); fetchData(); }}
                      aria-label="הסרת הפסקה"
                      className={`${ACTION_CIRCLE} h-6 w-6 bg-amber-100/60 text-amber-500`}
                    >
                      <X size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ======================= CUSTOMERS ======================= */}
        {activeTab === 'customers' && (
          <div className="anim-fade-up space-y-3">
            <div className="flex gap-1.5">
              <MiniStat label="מתמידות" value={customerBaseStats.loyalCustomers.length} />
              <MiniStat label="מזדמנות" value={customerBaseStats.newCustomersCount} />
              <MiniStat label="סך הכל" value={customerBaseStats.totalActiveCount} />
            </div>

            <section className={`${CARD} p-4`}>
              <SectionHeader
                icon={Users}
                title="מועדון לקוחות קבועות"
                description="רשימת הלקוחות הנאמנות שביצעו יותר מתור אחד במערכת (לא כולל המנהלת)."
              />

              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="חיפוש לקוחה לפי שם או טלפון..."
                  className="w-full rounded-full border border-slate-900/[0.06] bg-slate-100/50 py-2.5 pl-9 pr-9 text-right text-[13.5px] font-normal tracking-tight outline-none transition-all placeholder:text-slate-400 focus:border-[#c9a961]/40 focus:bg-white focus:ring-4 focus:ring-[#c9a961]/10"
                />
                <Search size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    aria-label="ניקוי חיפוש"
                    className={`${ACTION_CIRCLE} absolute left-2 top-1/2 h-6 w-6 -translate-y-1/2 bg-slate-300/40 text-slate-500`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {filteredCustomers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={searchTerm ? 'לא נמצאה לקוחה' : 'אין נתונים'}
                  description={searchTerm ? 'לא נמצאו לקוחות המתאימות לחיפוש.' : 'אין מספיק נתונים על לקוחות קבועות כרגע.'}
                />
              ) : (
                <div className="space-y-1.5">
                  {filteredCustomers.map((customer, index) => {
                    const isExpanded = expandedCustomer === customer.phone;

                    const customerHistory = bookings
                      .filter(b => b.customer_phone === customer.phone)
                      .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

                    return (
                      <div
                        key={customer.phone}
                        style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                        className={`anim-fade-up overflow-hidden ${CARD} transition-all ${
                          isExpanded ? 'border-[#c9a961]/30' : ''
                        }`}
                      >
                        <button
                          onClick={() => setExpandedCustomer(isExpanded ? null : customer.phone)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-right transition-colors active:bg-slate-100/40"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${GOLD_GRADIENT} text-[13px] font-semibold tabular-nums text-white shadow-[0_4px_12px_-3px_rgba(201,169,97,0.65)]`}
                            >
                              {customer.name.trim().charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="flex min-w-0 items-center gap-1.5 text-[16px] font-semibold not-italic leading-tight tracking-tight text-slate-900">
                                <span className="min-w-0 truncate leading-tight">{customer.name}</span>
                                <VipBadge count={customer.totalBookings} />
                              </h4>
                              <p className="mt-0.5 truncate text-[10.5px] font-normal tracking-tight tabular-nums text-slate-400">{customer.phone}</p>
                            </div>
                          </div>
                          <div
                            className="shrink-0 text-slate-300 transition-transform duration-300"
                            style={{ transform: isExpanded ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                          >
                            <ChevronLeft size={15} />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={`anim-fade-up space-y-2 border-t ${HAIRLINE} bg-[#FDFBF6]/40 p-2.5`}>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="rounded-xl bg-white/70 px-2 py-2 text-center ring-1 ring-inset ring-slate-900/[0.04]">
                                <p className="text-[8.5px] font-medium tracking-tight text-slate-400">ראשון</p>
                                <p className="mt-1 text-[11px] font-semibold tracking-tight tabular-nums text-slate-700">{formatHeDate(customer.firstVisit)}</p>
                              </div>
                              <div className="rounded-xl bg-white/70 px-2 py-2 text-center ring-1 ring-inset ring-slate-900/[0.04]">
                                <p className="text-[8.5px] font-medium tracking-tight text-slate-400">אחרון</p>
                                <p className="mt-1 text-[11px] font-semibold tracking-tight tabular-nums text-slate-700">{formatHeDate(customer.lastVisit)}</p>
                              </div>
                              <div className="rounded-xl bg-white/70 px-2 py-2 text-center ring-1 ring-inset ring-slate-900/[0.04]">
                                <p className="flex items-center justify-center gap-1 text-[8.5px] font-medium tracking-tight text-slate-400">
                                  <Heart size={8} className="fill-red-400 text-red-400" /> מועדף
                                </p>
                                <p className="mt-1 truncate text-[11px] font-semibold tracking-tight text-[#b8964f]">{customer.favoriteService}</p>
                              </div>
                            </div>

                            <div className="rounded-xl bg-white/70 p-3 ring-1 ring-inset ring-slate-900/[0.04]">
                              <div className={`mb-2 flex items-center gap-1.5 border-b ${HAIRLINE} pb-2`}>
                                <History size={11} className="text-slate-400" />
                                <h5 className="text-[10px] font-medium tracking-tight text-slate-500">
                                  תקציר תורים קודמים ({customerHistory.length})
                                </h5>
                              </div>
                              <div className="max-h-[150px] space-y-1.5 overflow-y-auto pl-0.5">
                                {customerHistory.map((historyItem) => (
                                  <div key={historyItem.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#FDFBF6]/70 px-2.5 py-2 text-right ring-1 ring-inset ring-slate-900/[0.04]">
                                    <div className="min-w-0">
                                      <p className="truncate text-[11.5px] font-medium not-italic leading-tight tracking-tight text-slate-800">{historyItem.service_title}</p>
                                      <p className="mt-0.5 text-[9.5px] font-normal tracking-tight tabular-nums text-slate-400">
                                        {formatHeDate(historyItem.date)} · {historyItem.start_time.slice(0, 5)}
                                      </p>
                                    </div>
                                    {historyItem.status === 'pending' ? (
                                      <Badge tone="amber">ממתין</Badge>
                                    ) : historyItem.date >= todayStr ? (
                                      <Badge tone="gold">עתידי</Badge>
                                    ) : (
                                      <Badge tone="slate">בוצע</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex gap-1.5">
                              <ContactChip icon={Phone} label="חיוג מהיר" href={`tel:${customer.phone}`} tone="slate" />
                              <ContactChip
                                icon={MessageCircle}
                                label="וואטסאפ"
                                onClick={() => window.open(`https://wa.me/972${customer.phone.replace(/^0/, '')}`)}
                                tone="green"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ======================= SERVICES ======================= */}
        {activeTab === 'services' && (
          <div className="anim-fade-up space-y-3">
            <div className="flex gap-1.5">
              <MiniStat label="סך טיפולים" value={dbServices.length} />
              <MiniStat
                label="זמן קצר ביותר"
                value={dbServices.length > 0 ? `${Math.min(...dbServices.map(s => s.duration_minutes))} דק'` : '0'}
              />
              <MiniStat label="באוויר" value={dbServices.length} />
            </div>

            <section className={`${CARD} p-4`}>
              <SectionHeader
                icon={Sparkles}
                title="מחירון ותפריט שירותים"
                description="עדכון, הוספה ומחיקה של טיפולים המופיעים ישירות בדף הזימון הראשי של הלקוחות."
                action={
                  <button
                    onClick={() => handleOpenServiceModal()}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold tracking-tight text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.35)] transition-all active:scale-95"
                  >
                    <Plus size={12} /> הוספה
                  </button>
                }
              />

              {dbServices.length === 0 ? (
                <EmptyState icon={Sparkles} title="אין שירותים" description="אין שירותים רשומים כרגע בבסיס הנתונים." />
              ) : (
                <div className="grid gap-1.5 md:grid-cols-2">
                  {dbServices.map((service, index) => (
                    <div
                      key={service.id}
                      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
                      className="anim-fade-up flex items-center justify-between gap-2 rounded-2xl border border-slate-900/[0.05] bg-white/70 px-3 py-2.5 shadow-[0_1px_8px_-3px_rgba(0,0,0,0.05)] backdrop-blur-xl transition-all hover:border-[#c9a961]/25 hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-[14px] font-semibold not-italic leading-tight tracking-tight text-slate-900">{service.title}</h4>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[12px] font-semibold tracking-tight tabular-nums text-[#b8964f]">{service.price}</span>
                          <span className="truncate text-[10px] font-normal tracking-tight tabular-nums text-slate-400">
                            {service.duration} · {service.duration_minutes} דק'
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => handleOpenServiceModal(service)}
                          aria-label={`עריכת ${service.title}`}
                          className={`${ACTION_CIRCLE} bg-slate-100/70 text-slate-600 ring-1 ring-inset ring-slate-600/[0.06]`}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteService(service.id)}
                          aria-label={`מחיקת ${service.title}`}
                          className={`${ACTION_CIRCLE} bg-red-50/80 text-red-500 ring-1 ring-inset ring-red-600/10`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ======================= ACTIVITY ======================= */}
        {activeTab === 'activity' && (
          <div className="anim-fade-up">
            <section className={`${CARD} p-4`}>
              <SectionHeader icon={History} title="פעילות אחרונה" description="20 הפעולות האחרונות שנרשמו במערכת." />

              {activities.length === 0 ? (
                <EmptyState icon={History} title="אין פעילות להצגה" description="פעולות במערכת יופיעו כאן אוטומטית." />
              ) : (
                <div className="relative space-y-2 before:absolute before:bottom-2 before:right-[5px] before:top-2 before:w-px before:bg-gradient-to-b before:from-[#c9a961]/40 before:via-slate-200 before:to-transparent">
                  {activities.map((act, index) => (
                    <div
                      key={act.id}
                      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                      className="anim-fade-up relative pr-5"
                    >
                      <span className="absolute right-0 top-3 h-2.5 w-2.5 rounded-full bg-[#FDFBF6] ring-2 ring-[#c9a961]" />
                      <div className="rounded-2xl border border-slate-900/[0.05] bg-white/70 px-3.5 py-2.5 shadow-[0_1px_8px_-3px_rgba(0,0,0,0.05)] backdrop-blur-xl">
                        <p className="text-[12px] font-normal leading-relaxed tracking-tight text-slate-800">{act.description || act.action}</p>
                        <p className="mt-1 text-[9.5px] font-medium tracking-tight tabular-nums text-slate-400">
                          {new Date(act.created_at).toLocaleDateString('he-IL')} · {new Date(act.created_at).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ---------------- Analytics floating bottom sheet ---------------- */}
      {isAnalyticsOpen && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="תובנות והכנסות"
        >
          <button
            type="button"
            aria-label="סגירה"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-md transition-opacity"
            onClick={() => setIsAnalyticsOpen(false)}
          />
          <div
            className="anim-sheet relative z-10 w-full max-w-lg rounded-t-[1.75rem] border border-white/50 border-b-0 bg-[#FDFBF6]/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300/80" aria-hidden="true" />

            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-tight text-slate-400">תובנות והכנסות</p>
                <h2 className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-900">
                  מבט כספי מהיר
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAnalyticsOpen(false)}
                aria-label="סגירה"
                className={`${ACTION_CIRCLE} bg-slate-200/50 text-slate-500`}
              >
                <X size={14} />
              </button>
            </div>

            {/* Hero metric */}
            <div className="mb-3 rounded-3xl border border-[#c9a961]/25 bg-gradient-to-br from-white/90 via-white/80 to-[#faf6ec]/80 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl">
              <p className="text-[10px] font-medium tracking-tight text-slate-400">הכנסה צפויה להיום</p>
              <p className="mt-1.5 text-[32px] font-semibold leading-none tracking-tight tabular-nums text-[#b8964f]">
                {formatILS(analytics.todayRevenue)}
              </p>
              <p className="mt-2 text-[10.5px] font-medium tracking-tight text-slate-400">
                מבוסס על תורים מאושרים · מחירון השירותים
              </p>
            </div>

            {/* 2×2 bento */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-900/[0.06] bg-white/85 p-3 shadow-sm backdrop-blur-2xl">
                <p className="text-[9px] font-medium tracking-tight text-slate-400">הכנסה חודשית</p>
                <p className="mt-1.5 text-[18px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                  {formatILS(analytics.monthRevenue)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/[0.06] bg-white/85 p-3 shadow-sm backdrop-blur-2xl">
                <p className="text-[9px] font-medium tracking-tight text-slate-400">שעות עבודה היום</p>
                <p className="mt-1.5 text-[18px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                  {formatWorkDuration(analytics.todayWorkMinutes)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/[0.06] bg-white/85 p-3 shadow-sm backdrop-blur-2xl">
                <p className="text-[9px] font-medium tracking-tight text-slate-400">טיפול מוביל</p>
                <p className="mt-1.5 truncate text-[13px] font-semibold leading-tight tracking-tight text-[#b8964f]">
                  {analytics.topService}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/[0.06] bg-white/85 p-3 shadow-sm backdrop-blur-2xl">
                <p className="text-[9px] font-medium tracking-tight text-slate-400">תורים שהושלמו</p>
                <p className="mt-1.5 text-[18px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                  {analytics.completedToday}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Quick calendar sheet ---------------- */}
      {isQuickCalendarOpen && (
        <div className={SCRIM} onClick={() => setIsQuickCalendarOpen(false)}>
          <div className={`${SHEET} max-w-[19rem] p-4 text-center`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-sans text-[15px] font-semibold not-italic leading-tight tracking-tight text-slate-900">ניווט מהיר ביומן</span>
              <button
                onClick={() => setIsQuickCalendarOpen(false)}
                aria-label="סגירה"
                className={`${ACTION_CIRCLE} bg-slate-200/50 text-slate-500`}
              >
                <X size={14} />
              </button>
            </div>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setIsQuickCalendarOpen(false); } }}
              modifiers={dayPickerModifiers}
              modifiersClassNames={dayPickerModifiersClassNames}
            />
            {calendarLegend}
          </div>
        </div>
      )}

      {/* ---------------- Smart Manual Booking modal ---------------- */}
      {isManualBookingOpen && (
        <div
          className={SCRIM}
          onClick={() => !savingManualBooking && setIsManualBookingOpen(false)}
        >
          <form
            onSubmit={handleCreateManualBooking}
            className={`${SHEET} max-h-[90vh] max-w-[21rem] overflow-y-auto p-5 text-right`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`mb-4 flex items-center justify-between border-b ${HAIRLINE} pb-3.5`}>
              <h2 className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-900">תור חדש ידני</h2>
              <button
                type="button"
                onClick={() => !savingManualBooking && setIsManualBookingOpen(false)}
                aria-label="סגירה"
                className={`${ACTION_CIRCLE} bg-slate-200/50 text-slate-500`}
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={FIELD_LABEL}>שירות</label>
                <select
                  required
                  value={manualBookingForm.serviceId}
                  onChange={(e) =>
                    setManualBookingForm((prev) => ({ ...prev, serviceId: e.target.value, startTime: '' }))
                  }
                  className={`${FIELD} appearance-none`}
                >
                  {dbServices.length === 0 && <option value="">אין שירותים</option>}
                  {dbServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.price} · {s.duration_minutes} דק'
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL}>תאריך</label>
                <input
                  type="date"
                  required
                  value={manualBookingForm.date}
                  onChange={(e) =>
                    setManualBookingForm((prev) => ({ ...prev, date: e.target.value, startTime: '' }))
                  }
                  className={`${FIELD} tabular-nums`}
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>שעות פנויות</label>
                {blockedDates.some((bd) => bd.date === manualBookingForm.date) ? (
                  <p className="rounded-2xl bg-red-50/80 px-3 py-2.5 text-[11px] font-medium tracking-tight text-red-500">
                    היום חסום במלואו — אין שעות זמינות.
                  </p>
                ) : manualAvailableSlots.length === 0 ? (
                  <p className="rounded-2xl bg-slate-100/60 px-3 py-2.5 text-[11px] font-medium tracking-tight text-slate-400">
                    אין שעות פנויות לתאריך ושירות אלו.
                  </p>
                ) : (
                  <div className="flex max-h-[8.5rem] flex-wrap gap-1.5 overflow-y-auto rounded-2xl bg-slate-50/50 p-2 ring-1 ring-inset ring-slate-900/[0.04]">
                    {manualAvailableSlots.map((slot) => {
                      const active = manualBookingForm.startTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setManualBookingForm((prev) => ({ ...prev, startTime: slot }))}
                          className={`rounded-2xl px-2.5 py-1.5 text-[12px] font-semibold tabular-nums tracking-tight transition-all active:scale-95 ${
                            active
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-white/90 text-slate-700 ring-1 ring-inset ring-slate-900/[0.06]'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={FIELD_LABEL}>שם הלקוחה</label>
                <input
                  type="text"
                  required
                  value={manualBookingForm.customerName}
                  onChange={(e) =>
                    setManualBookingForm((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  placeholder="שם מלא"
                  className={FIELD}
                />
              </div>

              <div>
                <label className={FIELD_LABEL}>טלפון</label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={manualBookingForm.customerPhone}
                  onChange={(e) =>
                    setManualBookingForm((prev) => ({
                      ...prev,
                      customerPhone: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  placeholder="05XXXXXXXX"
                  className={`${FIELD} tabular-nums`}
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50/70 px-3.5 py-3 ring-1 ring-inset ring-slate-900/[0.04]">
                <span className="text-[12px] font-medium tracking-tight text-slate-700">
                  שלח הודעת SMS לאישור התור
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={manualBookingForm.sendSms}
                  onClick={() =>
                    setManualBookingForm((prev) => ({ ...prev, sendSms: !prev.sendSms }))
                  }
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                    manualBookingForm.sendSms ? 'bg-[#c9a961]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      manualBookingForm.sendSms ? 'right-0.5' : 'right-[1.125rem]'
                    }`}
                  />
                </button>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingManualBooking || !manualBookingForm.startTime || dbServices.length === 0}
              className={`mt-5 ${BTN_DARK} disabled:opacity-50`}
            >
              {savingManualBooking && <Loader2 size={13} className="animate-spin" />}
              {savingManualBooking ? 'שומרת...' : 'קביעת תור מאושר'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- Service modal ---------------- */}
      {isServiceModalOpen && (
        <div className={SCRIM} onClick={() => setIsServiceModalOpen(false)}>
          <form
            onSubmit={handleSaveService}
            className={`${SHEET} max-h-[88vh] max-w-[20rem] overflow-y-auto p-5 text-right`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`mb-4 flex items-center justify-between border-b ${HAIRLINE} pb-3.5`}>
              <h2 className="font-sans text-[17px] font-semibold not-italic leading-tight tracking-tight text-slate-900">
                {editingService ? 'עריכת שירות קיים' : 'הוספת שירות חדש'}
              </h2>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(false)}
                aria-label="סגירה"
                className={`${ACTION_CIRCLE} bg-slate-200/50 text-slate-500`}
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={FIELD_LABEL}>שם הטיפול</label>
                <input
                  type="text"
                  required
                  value={serviceForm.title}
                  onChange={e => setServiceForm({...serviceForm, title: e.target.value})}
                  placeholder="לדוגמה: מבנה אנטומי - ג'ל"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>מחיר לתצוגה</label>
                <input
                  type="text"
                  required
                  value={serviceForm.price}
                  onChange={e => setServiceForm({...serviceForm, price: e.target.value})}
                  placeholder="לדוגמה: 150 ₪"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>זמן טיפול לתצוגה</label>
                <input
                  type="text"
                  required
                  value={serviceForm.duration}
                  onChange={e => setServiceForm({...serviceForm, duration: e.target.value})}
                  placeholder="לדוגמה: 90 דקות"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>זמן בדקות (לחישוב ביומן)</label>
                <input
                  type="number"
                  required
                  min={5}
                  max={300}
                  step={5}
                  value={serviceForm.duration_minutes}
                  onChange={e => setServiceForm({...serviceForm, duration_minutes: Number(e.target.value)})}
                  placeholder="לדוגמה: 90"
                  className={`${FIELD} tabular-nums`}
                />
              </div>
            </div>

            <button type="submit" className={`mt-5 ${BTN_DARK}`}>
              {editingService ? 'עדכון שירות בדאטה' : 'שמירה והעלאה לאוויר'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- Floating dock nav (all 6 tabs) ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
        <div className="mx-auto flex max-w-md items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/90 p-2 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl">
          {NAV_TABS.map(({ id, label, icon: Icon, badge }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center gap-[0.1875rem] rounded-full py-1.5 transition-transform duration-300 ease-out active:scale-95"
              >
                {/* Active indicator sits behind the label so it can cross-fade smoothly. */}
                <span
                  className={`absolute inset-0 rounded-full bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out ${
                    isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                  }`}
                />
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={`relative transition-colors duration-300 ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
                />
                <span
                  className={`relative text-[8px] leading-none tracking-tight transition-colors duration-300 ${
                    isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'
                  }`}
                >
                  {label}
                </span>
                {!!badge && badge > 0 && (
                  <span className="absolute -top-0.5 left-1 z-10 flex h-[0.9375rem] min-w-[0.9375rem] items-center justify-center rounded-full bg-red-500 px-[0.1875rem] text-[7.5px] font-semibold leading-none tabular-nums text-white ring-[1.5px] ring-slate-950/90">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
