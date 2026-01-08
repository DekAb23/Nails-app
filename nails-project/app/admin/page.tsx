'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { FaWhatsapp, FaPhone, FaTimes, FaCalendarTimes } from 'react-icons/fa';
import { supabase, Booking, BlockedDate, BlockedTimeSlot, logActivity, ActivityLog } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';


// LoginForm Component
function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError('אימייל או סיסמה שגויים');
        return;
      }

      if (data.session) {
        onLoginSuccess();
      }
    } catch (err) {
      setError('אירעה שגיאה בהתחברות');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-[#2c2c2c] mb-6">לוח בקרה</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#2c2c2c] mb-2">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
              placeholder="your@email.com"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#2c2c2c] mb-2">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
              placeholder="הכנס סיסמה"
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
        <button
          onClick={() => router.push('/')}
          className="w-full mt-4 px-6 py-2 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-lg font-medium transition-colors"
        >
          חזרה לעמוד הראשי
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showBlockDatePicker, setShowBlockDatePicker] = useState(false);
  const [dateToBlock, setDateToBlock] = useState<Date | undefined>(undefined);
  const [blockingDate, setBlockingDate] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  // Special Closures state
  const [specialClosureType, setSpecialClosureType] = useState<'full' | 'partial'>('full');
  const [partialBlockDate, setPartialBlockDate] = useState<Date | undefined>(undefined);
  const [partialBlockStartTime, setPartialBlockStartTime] = useState<string>('09:00');
  const [partialBlockEndTime, setPartialBlockEndTime] = useState<string>('10:00');
  const [savingPartialBlock, setSavingPartialBlock] = useState(false);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Check session on mount and listen to auth changes
  useEffect(() => {
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchBookings();
      fetchBlockedDates();
      fetchBlockedTimeSlots();
      fetchActivityLog();
    }
  }, [session]);

  const fetchActivityLog = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        console.error('Error fetching activity log:', error);
        setActivities([]);
      } else {
        setActivities(data || []);
      }
    } catch (error) {
      console.error('Error fetching activity log:', error);
      setActivities([]);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'זה עתה';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return date.toLocaleDateString('he-IL');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setBookings([]);
      setBlockedDates([]);
      setActivities([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
        alert('אירעה שגיאה בטעינת התורים');
      } else {
        setBookings(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בטעינת התורים');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching blocked dates:', error);
      } else {
        setBlockedDates(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchBlockedTimeSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_time_slots')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching blocked time slots:', error);
      } else {
        setBlockedTimeSlots(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleAddPartialBlock = async () => {
    if (!partialBlockDate) {
      alert('אנא בחר תאריך');
      return;
    }

    if (partialBlockStartTime >= partialBlockEndTime) {
      alert('שעת התחלה חייבת להיות לפני שעת הסיום');
      return;
    }

    setSavingPartialBlock(true);
    try {
      const dateStr = formatDateToString(partialBlockDate);
      const { error } = await supabase
        .from('blocked_time_slots')
        .insert([{
          date: dateStr,
          start_time: partialBlockStartTime,
          end_time: partialBlockEndTime
        }]);

      if (error) {
        console.error('Error adding partial block:', error);
        alert('אירעה שגיאה בהוספת חסימת זמן');
      } else {
        alert('חסימת זמן נוספה בהצלחה');
        // Format date and time for activity log
        const formattedDate = formatDate(dateStr);
        const formattedTime = partialBlockStartTime.slice(0, 5); // HH:mm format
        await logActivity('block', `חסימת שעה: השעה ${formattedTime} בתאריך ${formattedDate} נחסמה`);
        setPartialBlockDate(undefined);
        setPartialBlockStartTime('09:00');
        setPartialBlockEndTime('10:00');
        await fetchBlockedTimeSlots();
        await fetchBookings();
        await fetchActivityLog();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה');
    } finally {
      setSavingPartialBlock(false);
    }
  };

  const handleDeletePartialBlock = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את חסימת הזמן הזו?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blocked_time_slots')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting partial block:', error);
        alert('אירעה שגיאה במחיקת חסימת זמן');
      } else {
        // Find the slot to get its details for activity log
        const slot = blockedTimeSlots.find(s => s.id === id);
        if (slot) {
          await logActivity('blocked', `חסימת שעה הוסרה: ${slot.start_time}-${slot.end_time} בתאריך ${formatDate(slot.date)}`);
        }
        await fetchBlockedTimeSlots();
        await fetchBookings();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה במחיקת חסימת זמן');
    }
  };

  const handleBlockDate = async (date?: Date) => {
    const dateToUse = date || dateToBlock;
    if (!dateToUse) {
      alert('אנא בחר תאריך');
      return;
    }

    const dateStr = formatDateToString(dateToUse);
    setBlockingDate(true);
    
    try {
      // Check if date is already blocked
      const isBlocked = blockedDates.some(bd => bd.date === dateStr);
      
      if (isBlocked) {
        // Unblock: delete from blocked_dates table
        const { error } = await supabase
          .from('blocked_dates')
          .delete()
          .eq('date', dateStr);

        if (error) {
          console.error('Error unblocking date:', error);
          alert('אירעה שגיאה בשחרור החסימה');
        } else {
          alert('התאריך שוחרר מחסימה בהצלחה');
          await logActivity('blocked', `חסימת יום הוסרה: ${formatDate(dateStr)}`);
          setDateToBlock(undefined);
          setShowBlockDatePicker(false);
          // Immediately refresh blocked dates to update calendar
          await fetchBlockedDates();
          await fetchBookings();
          await fetchActivityLog();
        }
      } else {
        // Block: insert into blocked_dates table
        const { error } = await supabase
          .from('blocked_dates')
          .insert([{ date: dateStr }]);

        if (error) {
          console.error('Error blocking date:', error);
          alert('אירעה שגיאה בחסימת התאריך');
        } else {
          alert('התאריך נחסם בהצלחה');
          // Format date for activity log (DD/MM/YYYY)
          const dateObj = new Date(dateStr + 'T00:00:00');
          const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
          await logActivity('block', `חסימת יום מלא: התאריך ${formattedDate} נחסם לקבלת קהל`);
          setDateToBlock(undefined);
          setShowBlockDatePicker(false);
          // Immediately refresh blocked dates to update calendar
          await fetchBlockedDates();
          await fetchBookings();
          await fetchActivityLog();
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה');
    } finally {
      setBlockingDate(false);
    }
  };

  const handleUnblockDate = async (dateId: string, dateStr: string) => {
    if (!confirm('האם אתה בטוח שברצונך להסיר את החסימה מהתאריך הזה?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', dateId);

      if (error) {
        console.error('Error unblocking date:', error);
        alert('אירעה שגיאה בהסרת החסימה');
      } else {
        await logActivity('blocked', `חסימת יום הוסרה: ${formatDate(dateStr)}`);
        await fetchActivityLog();
        await fetchBlockedDates();
        await fetchBookings();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בהסרת החסימה');
    }
  };

  const handleWhatsApp = (booking: Booking) => {
    const phoneNumber = booking.customer_phone.startsWith('0') 
      ? booking.customer_phone.slice(1) 
      : booking.customer_phone;
    const whatsappUrl = `https://wa.me/972${phoneNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleCancelAndNotify = (booking: Booking) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את התור ולהודיע ללקוח?')) {
      return;
    }

    // Update booking status to cancelled
    supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)
      .then(async () => {
        // Format date and time for activity log
        const dateObj = new Date(booking.date + 'T00:00:00');
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        const formattedTime = booking.start_time ? booking.start_time.slice(0, 5) : ''; // HH:mm format
        await logActivity('cancel', `בוטל תור: ${booking.customer_name} שהיה קבוע ל-${formattedDate} בשעה ${formattedTime}`);
        await fetchBookings();
        await fetchActivityLog();
      });

    // Format date for message
    const date = new Date(booking.date + 'T00:00:00');
    const hebrewMonths = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    const formattedDate = `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;

    // Create WhatsApp message
    const message = `שלום ${booking.customer_name}, התור שלך ל${booking.service_title} בתאריך ${formattedDate} בשעה ${formatTime(booking.start_time)} בוטל. אנא צרו קשר לקביעת תור חדש.`;
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = booking.customer_phone.startsWith('0') ? booking.customer_phone.slice(1) : booking.customer_phone;
    const whatsappUrl = `https://wa.me/972${phoneNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Format date to YYYY-MM-DD in local timezone (avoid UTC offset issues)
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const hebrewMonths = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  };

  // Helper to normalize date to midnight local time for comparison
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Helper to format time string to HH:mm (remove seconds)
  const formatTime = (time: string): string => {
    if (!time) return '';
    // If time is in format HH:mm:ss, slice to HH:mm
    if (time.length >= 5) {
      return time.slice(0, 5);
    }
    return time;
  };

  // Simple array of dates with bookings for calendar indicators
  const bookingDates = useMemo(() => {
    const dates = new Set<string>();
    bookings.forEach(booking => {
      dates.add(booking.date);
    });
    return Array.from(dates).map(d => {
      // Parse YYYY-MM-DD and create date in local timezone
      const [year, month, day] = d.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return normalizeDate(date);
    });
  }, [bookings]);

  // Get blocked date objects
  const blockedDateObjects = useMemo(() => {
    return blockedDates.map(bd => {
      // Parse YYYY-MM-DD and create date in local timezone
      const [year, month, day] = bd.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return normalizeDate(date);
    });
  }, [blockedDates]);

  // Get bookings for selected date
  const dailyBookings = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatDateToString(selectedDate);
    return bookings.filter(b => b.date === dateStr).sort((a, b) => {
      return a.start_time.localeCompare(b.start_time);
    });
  }, [bookings, selectedDate]);

  // Calculate quick stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateToString(today);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const todayBookings = bookings.filter(b => b.date === todayStr);
    const weekBookings = bookings.filter(b => {
      const bookingDate = new Date(b.date + 'T00:00:00');
      return bookingDate >= weekStart && bookingDate <= weekEnd;
    });

    return {
      today: todayBookings.length,
      week: weekBookings.length,
      total: bookings.length
    };
  }, [bookings]);

  // Show loading state while checking auth
  if (checkingAuth) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 px-4">
        <div className="text-center">
          <div className="text-[#2c2c2c] text-lg">בודק הרשאות...</div>
        </div>
      </div>
    );
  }

  // Show login form if no session
  if (!session) {
    return <LoginForm onLoginSuccess={checkSession} />;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-[#2c2c2c]">לוח בקרה - אדר קוסמטיקס</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-lg font-medium transition-colors"
            >
              התנתק
            </button>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-[#e0e0e0]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#c9a961] rounded-full"></div>
              <span className="text-sm text-[#666666]">
                <span className="font-semibold text-[#2c2c2c]">{stats.today}</span> תורים היום
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-[#666666]">
                <span className="font-semibold text-[#2c2c2c]">{stats.week}</span> תורים השבוע
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-sm text-[#666666]">
                <span className="font-semibold text-[#2c2c2c]">{stats.total}</span> סה"כ תורים פעילים
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar Section */}
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-[#2c2c2c]">לוח שנה</h2>
              <button
                onClick={() => setShowBlockDatePicker(true)}
                className="px-3 py-1.5 text-xs md:text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <FaCalendarTimes />
                <span className="hidden sm:inline">חסום תאריך</span>
              </button>
            </div>
            
            <style jsx global>{`
              .rdp {
                --rdp-cell-size: 36px;
                --rdp-accent-color: #c9a961;
                --rdp-background-color: #f5f5f5;
                margin: 0;
                direction: rtl;
              }
              @media (min-width: 768px) {
                .rdp {
                  --rdp-cell-size: 40px;
                }
              }
              .rdp-months {
                display: flex;
                justify-content: center;
              }
              .rdp-month {
                margin: 0;
              }
              .rdp-table {
                width: 100%;
                max-width: none;
                border-collapse: collapse;
              }
              .rdp-head_cell {
                font-weight: 600;
                font-size: 0.75rem;
                padding: 0.4rem;
                color: #666666;
              }
              @media (min-width: 768px) {
                .rdp-head_cell {
                  font-size: 0.875rem;
                  padding: 0.5rem;
                }
              }
              .rdp-cell {
                width: var(--rdp-cell-size);
                height: var(--rdp-cell-size);
                position: relative;
              }
              .rdp-button {
                width: 100%;
                height: 100%;
                border-radius: 0.5rem;
                border: 1px solid transparent;
                background-color: transparent;
                color: #2c2c2c;
                font-size: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
              }
              @media (min-width: 768px) {
                .rdp-button {
                  font-size: 0.875rem;
                }
              }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #f5f5f5;
                border-color: #c9a961;
              }
              .rdp-button[disabled] {
                opacity: 0.3;
                cursor: not-allowed;
                color: #b0b0b0;
              }
              .rdp-day_selected .rdp-button {
                background-color: var(--rdp-accent-color);
                color: white;
                font-weight: 600;
              }
              .rdp-day_today .rdp-button {
                font-weight: 700;
                border: 2px solid #c9a961;
              }
              .rdp-day_has-bookings .rdp-button {
                background-image: radial-gradient(circle, #c9a961 2px, transparent 2px);
                background-position: bottom center;
                background-repeat: no-repeat;
              }
              .rdp-day_blocked .rdp-button {
                background-image: radial-gradient(circle, #fecaca 2px, transparent 2px);
                background-position: bottom center;
                background-repeat: no-repeat;
              }
              .rdp-day_blocked.rdp-day_selected .rdp-button {
                background-color: var(--rdp-accent-color);
                color: white;
              }
              .rdp-caption {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
              }
              .rdp-caption_label {
                font-weight: 600;
                font-size: 0.9rem;
                color: #2c2c2c;
              }
              @media (min-width: 768px) {
                .rdp-caption_label {
                  font-size: 1rem;
                }
              }
              .rdp-nav {
                display: flex;
                gap: 0.5rem;
              }
              .rdp-button_reset {
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                border: 1px solid #e0e0e0;
                background-color: white;
                cursor: pointer;
              }
              .rdp-button_reset:hover {
                background-color: #f5f5f5;
              }
            `}</style>
            
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  const normalized = normalizeDate(date);
                  setSelectedDate(normalized);
                }
              }}
              className="bg-white"
              modifiers={{
                hasBooking: bookingDates,
                blocked: blockedDateObjects
              }}
              modifiersClassNames={{
                hasBooking: 'has-bookings',
                blocked: 'blocked'
              }}
            />
            
            <div className="mt-4 pt-4 border-t border-[#e0e0e0] flex flex-wrap gap-3 text-xs md:text-sm text-[#666666]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#c9a961] rounded-full"></span>
                <span>ימים עם תורים</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-200 rounded-full"></span>
                <span>תאריכים חסומים</span>
              </div>
            </div>
          </div>

          {/* Daily Agenda */}
          <div className="bg-white rounded-2xl shadow-xl p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-[#2c2c2c] mb-4">
              יומן יומי - {formatDate(formatDateToString(selectedDate))}
            </h2>
            
            {loading ? (
              <div className="text-center py-8 text-[#666666]">טוען תורים...</div>
            ) : dailyBookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">📅</div>
                <p className="text-lg text-[#666666]">אין תורים לתאריך זה</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {dailyBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="border border-[#e0e0e0] rounded-lg p-3 md:p-4 bg-gradient-to-r from-white to-pink-50/30 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                          <div className="text-xl md:text-2xl font-bold text-[#c9a961] whitespace-nowrap">
                            {formatTime(booking.start_time)}
                          </div>
                          <div className="h-6 w-px bg-[#e0e0e0] hidden sm:block"></div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#2c2c2c] text-base md:text-lg truncate">
                              {booking.customer_name}
                            </div>
                            <div className="text-xs md:text-sm text-[#666666] truncate">
                              {booking.service_title}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-[#666666] mt-2 flex-wrap">
                          <span>{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</span>
                          <span className="text-[#cccccc] hidden sm:inline">•</span>
                          <span className="break-all">{booking.customer_phone}</span>
                          <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                            booking.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.status === 'confirmed' ? 'מאושר' : 'ממתין'}
                          </span>
                          {booking.is_verified === false && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs whitespace-nowrap font-medium">
                              ⚠️ NOT VERIFIED
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleWhatsApp(booking)}
                          className="px-3 md:px-4 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          title="WhatsApp"
                        >
                          <FaWhatsapp className="w-4 h-4" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </button>
                        <button
                          onClick={() => handleCall(booking.customer_phone)}
                          className="px-3 md:px-4 py-2 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          title="התקשר"
                        >
                          <FaPhone className="w-3 h-3" />
                          <span className="hidden sm:inline">שיחה</span>
                        </button>
                        <button
                          onClick={() => booking.id && handleCancelAndNotify(booking)}
                          className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                          title="בטל"
                        >
                          <FaTimes className="w-3 h-3" />
                          <span className="hidden sm:inline">ביטול</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Block Date Picker Modal */}
        {showBlockDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBlockDatePicker(false)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#2c2c2c]">בחר תאריך לחסימה</h3>
                <button
                  onClick={() => setShowBlockDatePicker(false)}
                  className="text-[#666666] hover:text-[#2c2c2c]"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <DayPicker
                mode="single"
                selected={dateToBlock}
                onSelect={(date) => setDateToBlock(date)}
                modifiers={{
                  blocked: blockedDateObjects
                }}
                modifiersClassNames={{
                  blocked: 'blocked'
                }}
                className="bg-white mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBlockDatePicker(false);
                    setDateToBlock(undefined);
                  }}
                  className="flex-1 px-4 py-2 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-lg font-medium transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={() => dateToBlock && handleBlockDate(dateToBlock)}
                  disabled={!dateToBlock || blockingDate}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    !dateToBlock || blockingDate
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : dateToBlock && blockedDates.some(bd => bd.date === formatDateToString(dateToBlock))
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {blockingDate 
                    ? 'מעבד...' 
                    : dateToBlock && blockedDates.some(bd => bd.date === formatDateToString(dateToBlock))
                    ? 'שחרר חסימה'
                    : 'חסום תאריך'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity Feed */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl md:text-2xl font-bold text-[#2c2c2c]">פעילות אחרונה</h3>
            <button
              onClick={fetchActivityLog}
              className="px-3 py-1.5 text-sm bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              title="רענן"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              רענן
            </button>
          </div>
          {activities.length === 0 ? (
            <p className="text-[#666666] text-center py-4">אין פעילות להצגה</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activities.map((activity) => {
                // Determine activity type for styling
                const activityType = activity.action;
                const isNewBooking = activityType === 'new_booking';
                const isVerified = activityType === 'verified';
                const isCancelled = activityType === 'cancelled';
                const isBlocked = activityType === 'blocked';
                
                // Check if this is a new booking that hasn't been verified
                let isUnverified = false;
                if (isNewBooking && activity.details.includes('תור חדש')) {
                  // Extract customer name from details (format: "תור חדש: [name] ל-[service]")
                  const match = activity.details.match(/תור חדש:\s*(.+?)\s*ל-/);
                  if (match) {
                    const customerName = match[1].trim();
                    // Check if there's an unverified booking with this customer name
                    const unverifiedBooking = bookings.find(
                      b => b.customer_name === customerName && b.is_verified === false
                    );
                    isUnverified = !!unverifiedBooking;
                  }
                }
                
                // Check if it's a recognized customer (זיהוי חוזר)
                const isRecognizedCustomer = activity.details.includes('זיהוי חוזר');
                
                // Get icon and color based on type
                const getActivityIcon = () => {
                  if (isNewBooking) return '📅';
                  if (isVerified) return '✅';
                  if (isCancelled) return '❌';
                  if (isBlocked) return '🚫';
                  return '📝';
                };

                const getActivityColor = () => {
                  if (isNewBooking || isVerified) return 'text-green-600';
                  if (isCancelled) return 'text-red-600';
                  if (isBlocked) return 'text-orange-600';
                  return 'text-blue-600';
                };

                const getActivityBgColor = () => {
                  if (isNewBooking || isVerified) return 'bg-green-50 border-green-200';
                  if (isCancelled) return 'bg-red-50 border-red-200';
                  if (isBlocked) return 'bg-orange-50 border-orange-200';
                  return 'bg-blue-50 border-blue-200';
                };
                
                return (
                  <div
                    key={activity.id}
                    className={`flex items-start gap-3 p-3 rounded-lg hover:opacity-90 transition-all border ${getActivityBgColor()}`}
                  >
                    <div className={`text-xl flex-shrink-0 ${getActivityColor()}`}>
                      {getActivityIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`text-sm md:text-base font-medium ${getActivityColor()}`}>
                          {activity.details}
                        </div>
                        {isUnverified && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded whitespace-nowrap">
                            ⚠️ NOT VERIFIED
                          </span>
                        )}
                        {isRecognizedCustomer && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded whitespace-nowrap">
                            👤 Recognized Customer
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#666666] mt-1">{formatTimeAgo(new Date(activity.created_at))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Blocked Dates Section */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-4 md:p-6">
          <h3 className="text-xl font-bold text-[#2c2c2c] mb-4">תאריכים חסומים</h3>
          {blockedDates.length === 0 ? (
            <p className="text-[#666666] text-center py-4">אין תאריכים חסומים</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map((blocked) => (
                <div
                  key={blocked.date}
                  className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-[#2c2c2c]">{formatDate(blocked.date)}</span>
                  <button
                    onClick={() => blocked.id && handleUnblockDate(blocked.id, blocked.date)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                    title="הסר חסימה"
                  >
                    <FaTimes className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Special Closures Section */}
        <div className="mt-6 bg-white rounded-2xl shadow-xl p-4 md:p-6">
          <h3 className="text-xl md:text-2xl font-bold text-[#2c2c2c] mb-4">חסימות מיוחדות</h3>
          
          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-[#e0e0e0]">
            <button
              onClick={() => setSpecialClosureType('full')}
              className={`px-4 py-2 font-medium transition-colors ${
                specialClosureType === 'full'
                  ? 'text-[#c9a961] border-b-2 border-[#c9a961]'
                  : 'text-[#666666] hover:text-[#2c2c2c]'
              }`}
            >
              חסימת יום מלא
            </button>
            <button
              onClick={() => setSpecialClosureType('partial')}
              className={`px-4 py-2 font-medium transition-colors ${
                specialClosureType === 'partial'
                  ? 'text-[#c9a961] border-b-2 border-[#c9a961]'
                  : 'text-[#666666] hover:text-[#2c2c2c]'
              }`}
            >
              חסימת זמן חלקית
            </button>
          </div>

          {/* Full Day Block Tab */}
          {specialClosureType === 'full' && (
            <div>
              <p className="text-[#666666] mb-4">
                לחצו על כפתור "חסום תאריך" בלוח השנה כדי לחסום יום מלא
              </p>
            </div>
          )}

          {/* Partial Block Tab */}
          {specialClosureType === 'partial' && (
            <div className="space-y-6">
              {/* Add Partial Block Form */}
              <div className="bg-[#f5f5f5] rounded-lg p-4">
                <h4 className="text-lg font-semibold text-[#2c2c2c] mb-4">הוסף חסימת זמן</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2c2c2c] mb-2">
                      תאריך
                    </label>
                    <DayPicker
                      mode="single"
                      selected={partialBlockDate}
                      onSelect={(date) => setPartialBlockDate(date)}
                      className="bg-white rounded-lg p-2"
                      modifiers={{
                        blocked: blockedDateObjects
                      }}
                      modifiersClassNames={{
                        blocked: 'blocked'
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-2">
                        שעת התחלה
                      </label>
                      <input
                        type="time"
                        value={partialBlockStartTime}
                        onChange={(e) => setPartialBlockStartTime(e.target.value)}
                        className="w-full border border-[#e0e0e0] rounded-lg px-4 py-2 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2c2c2c] mb-2">
                        שעת סיום
                      </label>
                      <input
                        type="time"
                        value={partialBlockEndTime}
                        onChange={(e) => setPartialBlockEndTime(e.target.value)}
                        className="w-full border border-[#e0e0e0] rounded-lg px-4 py-2 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddPartialBlock}
                    disabled={!partialBlockDate || savingPartialBlock}
                    className="w-full px-4 py-2 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPartialBlock ? 'מוסיף...' : 'הוסף חסימת זמן'}
                  </button>
                </div>
              </div>

              {/* Existing Partial Blocks List */}
              <div>
                <h4 className="text-lg font-semibold text-[#2c2c2c] mb-4">חסימות זמן קיימות</h4>
                {blockedTimeSlots.length === 0 ? (
                  <p className="text-[#666666] text-center py-4">אין חסימות זמן חלקיות</p>
                ) : (
                  <div className="space-y-2">
                    {blockedTimeSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-[#2c2c2c]">
                            {formatDate(slot.date)}
                          </span>
                          <span className="text-sm text-[#666666]">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </span>
                        </div>
                        <button
                          onClick={() => slot.id && handleDeletePartialBlock(slot.id)}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                          title="מחק"
                        >
                          <FaTimes className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
