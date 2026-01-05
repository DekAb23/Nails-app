'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { FaWhatsapp, FaPhone, FaTimes, FaCalendarTimes } from 'react-icons/fa';
import { supabase, Booking, BlockedDate } from '@/lib/supabase';

const ADMIN_PASSWORD = '1234';

interface Activity {
  id: string;
  type: 'booking_created' | 'booking_cancelled' | 'date_blocked' | 'date_unblocked';
  message: string;
  timestamp: Date;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showBlockDatePicker, setShowBlockDatePicker] = useState(false);
  const [dateToBlock, setDateToBlock] = useState<Date | undefined>(undefined);
  const [blockingDate, setBlockingDate] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookings();
      fetchBlockedDates();
      // Load activities from localStorage
      const savedActivities = localStorage.getItem('admin_activities');
      if (savedActivities) {
        try {
          const parsed = JSON.parse(savedActivities);
          setActivities(parsed.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          })).slice(0, 10));
        } catch (e) {
          console.error('Error loading activities:', e);
        }
      }
    }
  }, [isAuthenticated]);

  const addActivity = (activity: Omit<Activity, 'id' | 'timestamp'>) => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      ...activity,
      timestamp: new Date()
    };
    const updated = [newActivity, ...activities].slice(0, 10);
    setActivities(updated);
    localStorage.setItem('admin_activities', JSON.stringify(updated));
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      setPassword('');
    } else {
      setError('סיסמה שגויה');
      setPassword('');
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
          addActivity({
            type: 'date_unblocked',
            message: `תאריך ${formatDate(dateStr)} שוחרר מחסימה`
          });
          setDateToBlock(undefined);
          setShowBlockDatePicker(false);
          // Immediately refresh blocked dates to update calendar
          await fetchBlockedDates();
          await fetchBookings();
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
          addActivity({
            type: 'date_blocked',
            message: `תאריך ${formatDate(dateStr)} נחסם`
          });
          setDateToBlock(undefined);
          setShowBlockDatePicker(false);
          // Immediately refresh blocked dates to update calendar
          await fetchBlockedDates();
          await fetchBookings();
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
        addActivity({
          type: 'date_unblocked',
          message: `תאריך ${formatDate(dateStr)} שוחרר מחסימה`
        });
        fetchBlockedDates();
        fetchBookings();
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
      .then(() => {
        addActivity({
          type: 'booking_cancelled',
          message: `תור של ${booking.customer_name} בוטל`
        });
        fetchBookings();
      });

    // Format date for message
    const date = new Date(booking.date + 'T00:00:00');
    const hebrewMonths = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    const formattedDate = `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;

    // Create WhatsApp message
    const message = `שלום ${booking.customer_name}, התור שלך ל${booking.service_title} בתאריך ${formattedDate} בשעה ${booking.start_time} בוטל. אנא צרו קשר לקביעת תור חדש.`;
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

  // Get dates with bookings for calendar indicators
  // react-day-picker modifiers need Date objects that match calendar dates exactly
  const datesWithBookings = useMemo(() => {
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
    const todayStr = today.toISOString().split('T')[0];
    
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

  if (!isAuthenticated) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center text-[#2c2c2c] mb-6">לוח בקרה</h1>
          <form onSubmit={handleLogin} className="space-y-4">
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
                autoFocus
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
            <button
              type="submit"
              className="w-full px-6 py-3 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors"
            >
              התחבר
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

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-[#2c2c2c]">לוח בקרה - אדר קוסמטיקס</h1>
            <button
              onClick={() => setIsAuthenticated(false)}
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
              .rdp-day_has-bookings .rdp-button::after {
                content: '';
                position: absolute;
                bottom: 3px;
                left: 50%;
                transform: translateX(-50%);
                width: 6px;
                height: 6px;
                background-color: #c9a961;
                border-radius: 50%;
              }
              .rdp-day_blocked .rdp-button {
                background-color: #fee2e2 !important;
                color: #991b1b !important;
                opacity: 0.85;
                position: relative;
              }
              .rdp-day_blocked .rdp-button::after {
                content: '✕';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 14px;
                font-weight: bold;
                line-height: 1;
                z-index: 1;
              }
              .rdp-day_blocked.rdp-day_selected .rdp-button {
                background-color: #dc2626 !important;
                color: white !important;
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
                hasBookings: datesWithBookings,
                blocked: blockedDateObjects
              }}
              modifiersClassNames={{
                hasBookings: 'has-bookings',
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
                            {booking.start_time}
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
                          <span>{booking.start_time} - {booking.end_time}</span>
                          <span className="text-[#cccccc] hidden sm:inline">•</span>
                          <span className="break-all">{booking.customer_phone}</span>
                          <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                            booking.status === 'confirmed' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {booking.status === 'confirmed' ? 'מאושר' : 'ממתין'}
                          </span>
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
          <h3 className="text-xl md:text-2xl font-bold text-[#2c2c2c] mb-4">פעילות אחרונה</h3>
          {activities.length === 0 ? (
            <p className="text-[#666666] text-center py-4">אין פעילות להצגה</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-[#f5f5f5] rounded-lg hover:bg-[#eeeeee] transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    activity.type === 'booking_created' ? 'bg-green-500' :
                    activity.type === 'booking_cancelled' ? 'bg-red-500' :
                    activity.type === 'date_blocked' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm md:text-base text-[#2c2c2c]">{activity.message}</div>
                    <div className="text-xs text-[#666666] mt-1">{formatTimeAgo(activity.timestamp)}</div>
                  </div>
                </div>
              ))}
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
      </div>
    </div>
  );
}
