'use client';

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { SiWaze } from 'react-icons/si';
import { Instagram } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { supabase, Booking, BlockedDate, BlockedTimeSlot, DailySchedule, logActivity } from '@/lib/supabase';
import { isPhoneVerified, createVerifiedSession, clearAllSessions, getAllVerifiedPhones } from '@/lib/session';

type Step = 'services' | 'calendar' | 'contact' | 'verification' | 'success';

interface Activity {
  id: string;
  type: 'booking_created' | 'booking_cancelled' | 'date_blocked' | 'date_unblocked';
  message: string;
  timestamp: Date;
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
  const [cancellationLink, setCancellationLink] = useState<string | null>(null);
  
  // Verification state
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string>('');
  
  // My Appointments Modal State
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [appointmentsPhone, setAppointmentsPhone] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Booking[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [appointmentsVerified, setAppointmentsVerified] = useState(false);
  const [appointmentsVerificationCode, setAppointmentsVerificationCode] = useState<string>('');
  const [appointmentsVerifying, setAppointmentsVerifying] = useState(false);
  const [appointmentsVerificationError, setAppointmentsVerificationError] = useState<string>('');
  const [appointmentsNeedsVerification, setAppointmentsNeedsVerification] = useState(false);
  
  // Blocked dates state
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(false);
  const [blockedTimeSlots, setBlockedTimeSlots] = useState<BlockedTimeSlot[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);

  const services = [
    {
      id: 'anatomical-gel',
      title: "מבנה אנטומי - ג'ל בנייה",
      price: "150 ₪",
      duration: "90 דקות",
      durationMinutes: 90,
    },
    {
      id: 'anatomical-gel-extended',
      title: "בנייה חדשה בטיפס ג'ל",
      price: "250 ₪",
      duration: "150 דקות",
      durationMinutes: 150,
    },
    {
      id: 'gel-pedicure',
      title: "לק ג'ל רגליים",
      price: "100 ₪",
      duration: "40 דקות",
      durationMinutes: 40,
    },
    {
      id: 'eyebrows-mustache',
      title: "גבות / שפם",
      price: "60 ₪",
      duration: "20 דקות",
      durationMinutes: 20,
    },
  ];

  const selectedServiceData = services.find(s => s.id === selectedService);

  // Fetch blocked dates on component mount
  useEffect(() => {
    fetchBlockedDates();
  }, []);

  // Auto-load appointments when modal opens if user has active session
  useEffect(() => {
    if (showMyAppointments) {
      const verifiedPhones = getAllVerifiedPhones();
      if (verifiedPhones.length > 0) {
        // Use the first verified phone (most recent)
        const verifiedPhone = verifiedPhones[0];
        setAppointmentsPhone(verifiedPhone);
        fetchMyAppointments(verifiedPhone, true);
      }
    }
  }, [showMyAppointments]);

  // Fetch bookings, blocked time slots, and daily schedule when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchBookings(selectedDate);
      fetchBlockedTimeSlotsForDate(selectedDate);
      fetchDailyScheduleForDate(selectedDate);
    } else {
      setBookings([]);
      setBlockedTimeSlots([]);
      setDailySchedule(null);
    }
  }, [selectedDate]);

  const fetchBlockedDates = async () => {
    setLoadingBlockedDates(true);
    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*');

      if (error) {
        console.error('Error fetching blocked dates:', error);
      } else {
        setBlockedDates(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingBlockedDates(false);
    }
  };

  const fetchBlockedTimeSlotsForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('blocked_time_slots')
        .select('*')
        .eq('date', dateStr)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching blocked time slots:', error);
        setBlockedTimeSlots([]);
      } else {
        setBlockedTimeSlots(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
      setBlockedTimeSlots([]);
    }
  };

  const fetchDailyScheduleForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_schedules')
        .select('*')
        .eq('date', dateStr)
        .single();

      if (error) {
        // If no schedule found (error code PGRST116), that's fine - use defaults
        if (error.code === 'PGRST116') {
          setDailySchedule(null);
        } else {
          console.error('Error fetching daily schedule:', error);
          setDailySchedule(null);
        }
      } else {
        setDailySchedule(data);
      }
    } catch (error) {
      console.error('Error:', error);
      setDailySchedule(null);
    }
  };

  const fetchBookings = async (date: Date) => {
    setLoadingBookings(true);
    try {
      // Format date as YYYY-MM-DD using local time (not UTC)
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', dateStr)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching bookings:', error);
      } else {
        // Filter out cancelled bookings (in case status filter doesn't work)
        const activeBookings = (data || []).filter(booking => booking.status !== 'cancelled');
        setBookings(activeBookings);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Check if a time slot conflicts with existing bookings or blocked time slots
  const isTimeSlotBlocked = (slotStart: string, slotEnd: string, date: Date): boolean => {
    // Convert time strings to minutes for comparison
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const slotStartMinutes = timeToMinutes(slotStart);
    const slotEndMinutes = timeToMinutes(slotEnd);
    const dateStr = format(date, 'yyyy-MM-dd');

    // Check conflicts with bookings (bookings are already filtered for the selected date)
    const conflictsWithBooking = bookings.some(booking => {
      const bookingStartMinutes = timeToMinutes(booking.start_time);
      const bookingEndMinutes = timeToMinutes(booking.end_time);
      // Check for overlap: slot overlaps if it starts before booking ends AND ends after booking starts
      return slotStartMinutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes;
    });

    // Check conflicts with blocked time slots for this date
    const conflictsWithBlockedSlot = blockedTimeSlots.some(blockedSlot => {
      if (blockedSlot.date !== dateStr) return false;
      const blockedStartMinutes = timeToMinutes(blockedSlot.start_time);
      const blockedEndMinutes = timeToMinutes(blockedSlot.end_time);
      // Check for overlap: slot overlaps if it starts before blocked slot ends AND ends after blocked slot starts
      return slotStartMinutes < blockedEndMinutes && slotEndMinutes > blockedStartMinutes;
    });

    return conflictsWithBooking || conflictsWithBlockedSlot;
  };

  // Hebrew day names
  const hebrewDays = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  // Safe date parser for Android/Chrome compatibility
  const parseDateString = (dateStr: string): Date => {
    // Split date string (format: YYYY-MM-DD) and construct date manually
    const [year, month, day] = dateStr.split('-').map(Number);
    // month is 0-indexed in Date constructor, so subtract 1
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Prepare disabled dates for DayPicker
  const disabledDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2); // 2 months ahead
    maxDate.setHours(23, 59, 59, 999);
    
    const blockedDateObjects: Date[] = blockedDates.map(bd => {
      return parseDateString(bd.date);
    });

    // Combine matchers and blocked dates
    return [
      { before: today }, // Disable past dates
      { after: maxDate }, // Disable dates beyond 2 months
      { dayOfWeek: [6] }, // Disable Saturday (6) only - Friday is now available
      ...blockedDateObjects // Disable blocked dates
    ];
  }, [blockedDates]);

  // Generate available time slots dynamically based on blocked time slots and bookings
  const availableSlots = useMemo(() => {
    if (!selectedServiceData || !selectedDate) return [];

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Check if the whole day is blocked
    const isFullDayBlocked = blockedDates.some(bd => bd.date === dateStr);
    if (isFullDayBlocked) {
      return [];
    }

    // Helper functions
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const formatTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    // Determine working hours: check daily_schedules first, then use defaults
    // Default: 09:00-18:00 for Sun-Thu, 09:00-12:00 for Friday, closed for Saturday
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    
    let workingStartMinutes: number;
    let workingEndMinutes: number;
    
    if (dailySchedule) {
      // Use custom schedule from daily_schedules table
      workingStartMinutes = timeToMinutes(dailySchedule.start_time);
      workingEndMinutes = timeToMinutes(dailySchedule.end_time);
    } else {
      // Use defaults based on day of week
      if (dayOfWeek === 6) {
        // Saturday - closed by default (return empty slots)
        return [];
      } else if (dayOfWeek === 5) {
        // Friday - 09:00-12:00
        workingStartMinutes = 9 * 60; // 09:00
        workingEndMinutes = 12 * 60; // 12:00
      } else {
        // Sunday-Thursday: 09:00-18:00
        workingStartMinutes = 9 * 60; // 09:00
        workingEndMinutes = 18 * 60; // 18:00
      }
    }
    
    // Get blocked time slots for this date, sorted by start_time
    const dateBlockedSlots = blockedTimeSlots
      .filter(bt => bt.date === dateStr)
      .map(bt => ({
        start: timeToMinutes(bt.start_time),
        end: timeToMinutes(bt.end_time)
      }))
      .sort((a, b) => a.start - b.start);

    const duration = selectedServiceData.durationMinutes;
    const slots: { start: string; end: string; key: string }[] = [];

    // Build available time windows (gaps between blocked slots)
    const availableWindows: { start: number; end: number }[] = [];
    let currentPos = workingStartMinutes;

    // Process blocked slots to find available windows
    for (const blocked of dateBlockedSlots) {
      // If blocked slot starts after current position, there's an available window
      if (blocked.start > currentPos) {
        availableWindows.push({
          start: currentPos,
          end: Math.min(blocked.start, workingEndMinutes)
        });
      }
      // Move current position to end of blocked slot (or later if already past)
      currentPos = Math.max(currentPos, blocked.end);
    }

    // Add final window from last position to end of working hours
    if (currentPos < workingEndMinutes) {
      availableWindows.push({
        start: currentPos,
        end: workingEndMinutes
      });
    }

    // Generate slots within each available window
    for (const window of availableWindows) {
      let windowStart = window.start;

      while (windowStart + duration <= window.end) {
        const slotEnd = windowStart + duration;
        const startTime = formatTime(windowStart);
        const endTime = formatTime(slotEnd);
        const key = `${startTime}-${endTime}`;

        // Safety check: ensure slot doesn't overlap with any booking
        const overlapsWithBooking = bookings.some(booking => {
          const bookingStart = timeToMinutes(booking.start_time);
          const bookingEnd = timeToMinutes(booking.end_time);
          // Check for overlap: slot overlaps if it starts before booking ends AND ends after booking starts
          return windowStart < bookingEnd && slotEnd > bookingStart;
        });

        // Safety check: ensure slot doesn't overlap with any blocked time slot (double check)
        const overlapsWithBlocked = dateBlockedSlots.some(blocked => {
          return windowStart < blocked.end && slotEnd > blocked.start;
        });

        if (!overlapsWithBooking && !overlapsWithBlocked) {
          slots.push({ start: startTime, end: endTime, key });
        }

        // Next slot starts where this one ends
        windowStart = slotEnd;
      }
    }

    // Filter out past slots if the selected date is today
    const today = new Date();
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
    
    if (isToday) {
      // Get current time in minutes
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      
      // Filter out slots that start before the current time
      return slots.filter(slot => {
        const slotStartMinutes = timeToMinutes(slot.start);
        return slotStartMinutes >= currentMinutes;
      });
    }

    return slots;
  }, [selectedServiceData, selectedDate, blockedTimeSlots, blockedDates, bookings, dailySchedule]);

  const formatDate = (date: Date): string => {
    return `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  };

  const formatDayOfWeek = (date: Date): string => {
    return hebrewDays[date.getDay()];
  };

  const getSelectedTimeSlotText = (): string => {
    if (!selectedTime) return '';
    const selectedSlot = availableSlots.find(slot => slot.key === selectedTime);
    return selectedSlot ? `${selectedSlot.start} - ${selectedSlot.end}` : '';
  };

  const handleContinue = () => {
    if (selectedService) {
      setStep('calendar');
    }
  };

  const handleBack = () => {
    if (step === 'contact') {
      setStep('calendar');
    } else if (step === 'verification') {
      setStep('contact');
      setVerificationCode('');
      setVerificationError('');
    } else if (step === 'success') {
      setStep('services');
      setSelectedService(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setCustomerName('');
      setCustomerPhone('');
      setCancellationLink(null);
      setCurrentBookingId(null);
      setVerificationCode('');
    } else {
      setStep('services');
      setSelectedDate(null);
      setSelectedTime(null);
    }
  };

  const handleConfirmBooking = () => {
    if (selectedDate && selectedTime) {
      setStep('contact');
    }
  };

  // Validate Israeli phone number (supports formats like 0501234567, 050-123-4567, etc.)
  const isValidPhoneNumber = (phone: string): boolean => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    // Israeli phone numbers are 9-10 digits, typically starting with 05
    return digitsOnly.length >= 9 && digitsOnly.length <= 10 && /^05/.test(digitsOnly);
  };

  const isFormValid = customerName.trim().length > 0 && isValidPhoneNumber(customerPhone);

  const handleWhatsAppBooking = async () => {
    if (!selectedServiceData || !selectedDate || !selectedTime || !customerName || !isFormValid) {
      console.error('Validation failed:', {
        selectedServiceData: !!selectedServiceData,
        selectedDate: !!selectedDate,
        selectedTime: !!selectedTime,
        customerName: !!customerName,
        isFormValid
      });
      return;
    }

    setSavingBooking(true);
    try {
      // Get selected time slot details
      const selectedSlot = availableSlots.find(slot => slot.key === selectedTime);
      if (!selectedSlot) {
        throw new Error('Selected time slot not found');
      }

      // Format date as YYYY-MM-DD for database using local time (not UTC)
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Generate cancellation token
      const cancellationToken = uuidv4();

      // Prepare booking data
      const customerPhoneDigits = customerPhone.replace(/\D/g, '');
      
      // Check if user has an active verified session
      const hasActiveSession = isPhoneVerified(customerPhoneDigits);
      
      let verificationCode = '';
      let isVerified = false;
      
      if (hasActiveSession) {
        // User has active session - skip verification
        isVerified = true;
        console.log('Active session detected, skipping verification');
      } else {
        // New user or expired session - generate verification code
        verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Send SMS via API route (server-side)
        try {
          const smsResponse = await fetch('/api/sms', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: customerPhoneDigits,
              code: verificationCode,
              customerName: customerName.trim(),
            }),
          });
          
          if (!smsResponse.ok) {
            console.error('Failed to send SMS:', await smsResponse.text());
          }
        } catch (error) {
          console.error('Error sending SMS:', error);
        }
        
        isVerified = false;
      }

      const newBooking: Omit<Booking, 'id' | 'created_at'> = {
        service_id: selectedServiceData.id,
        service_title: selectedServiceData.title,
        service_duration: selectedServiceData.durationMinutes,
        date: dateStr,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        customer_name: customerName.trim(),
        customer_phone: customerPhoneDigits,
        cancellation_token: cancellationToken,
        status: 'confirmed',
        is_verified: isVerified,
        verification_code: verificationCode || undefined,
      };

      // Log what we're sending
      console.log('Attempting to save booking with data:', JSON.stringify(newBooking, null, 2));
      console.log('Booking fields:', {
        service_id: newBooking.service_id,
        service_title: newBooking.service_title,
        service_duration: newBooking.service_duration,
        date: newBooking.date,
        start_time: newBooking.start_time,
        end_time: newBooking.end_time,
        customer_name: newBooking.customer_name,
        customer_phone: newBooking.customer_phone,
      });

      const { data, error } = await supabase
        .from('bookings')
        .insert([newBooking])
        .select()
        .single();

      if (error) {
        // Detailed error logging
        console.error('=== SUPABASE ERROR DETAILS ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        console.error('Data that was sent:', JSON.stringify(newBooking, null, 2));
        console.error('============================');
        
        // Show user-friendly error with details
        const errorMsg = error.message || 'Unknown error';
        const errorDetails = error.details ? ` (${error.details})` : '';
        alert(`אירעה שגיאה בשמירת התור:\n${errorMsg}${errorDetails}\n\nנא לבדוק את הקונסול לפרטים נוספים.`);
        setSavingBooking(false);
        return;
      }

      console.log('Booking saved successfully:', data);

      if (data?.id) {
        // Format date and time for activity log
        const formattedDate = format(selectedDate, 'dd/MM/yyyy');
        const formattedTime = selectedSlot.start.slice(0, 5); // HH:mm format
        
        // Add activity log entries
        if (hasActiveSession) {
          // Trusted user - log as recognized customer
          await logActivity('verified', `לקוחה מוכרת חזרה: ${customerName.trim()} (זוהתה ללא SMS)`);
          await logActivity('new_booking', `תור חדש: ${customerName.trim()} ל-${selectedServiceData.title} בתאריך ${formattedDate} בשעה ${formattedTime}`);
          
          // Refresh bookings
          if (selectedDate) {
            await fetchBookings(selectedDate);
          }
          
          setStep('success');
        } else {
          // New user - log as new booking
          await logActivity('new_booking', `תור חדש: ${customerName.trim()} ל-${selectedServiceData.title} בתאריך ${formattedDate} בשעה ${formattedTime}`);
          
          // Go to verification step
          setCurrentBookingId(data.id);
          setStep('verification');
        }
      } else {
        alert('אירעה שגיאה בשמירת התור. נא לנסות שוב.');
        setSavingBooking(false);
        return;
      }
    } catch (error: any) {
      console.error('=== GENERAL ERROR IN BOOKING PROCESS ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Full error:', JSON.stringify(error, null, 2));
      console.error('==========================================');
      
      const errorMsg = error?.message || 'Unknown error occurred';
      alert(`אירעה שגיאה בתהליך ההזמנה:\n${errorMsg}\n\nנא לבדוק את הקונסול לפרטים נוספים.`);
    } finally {
      setSavingBooking(false);
    }
  };

  const handleVerification = async () => {
    if (!currentBookingId || !verificationCode) {
      setVerificationError('אנא הכנס קוד אימות');
      return;
    }

    if (verificationCode.length !== 4) {
      setVerificationError('קוד אימות חייב להיות 4 ספרות');
      return;
    }

    setVerifying(true);
    setVerificationError('');

    try {
      const customerPhoneDigits = customerPhone.replace(/\D/g, '');
      
      // Use unified verification API
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: customerPhoneDigits,
          code: verificationCode,
          bookingId: currentBookingId,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.verified) {
        setVerificationError('קוד אימות שגוי. נא לנסות שוב.');
        setVerifying(false);
        return;
      }

      // Create verified session
      createVerifiedSession(customerPhoneDigits);

      // Get booking details for activity log
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('date, start_time')
        .eq('id', currentBookingId)
        .single();

      if (bookingData) {
        const formattedDate = format(parseDateString(bookingData.date), 'dd/MM/yyyy');
        const formattedTime = bookingData.start_time.slice(0, 5); // HH:mm format
        
        // Add activity log entry
        await logActivity('verified', `תור אומת: ${customerName.trim()} ל-${selectedServiceData?.title}`);
        await logActivity('new_booking', `תור חדש: ${customerName.trim()} ל-${selectedServiceData?.title} בתאריך ${formattedDate} בשעה ${formattedTime}`);
      }

      // Refresh bookings
      if (selectedDate) {
        await fetchBookings(selectedDate);
      }

      // Move to success step
      setStep('success');
      setVerificationCode('');
      setCurrentBookingId(null);
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationError('אירעה שגיאה בתהליך האימות. נא לנסות שוב.');
    } finally {
      setVerifying(false);
    }
  };

  // Fetch user's appointments by phone number (requires verification)
  const fetchMyAppointments = async (phone: string, skipVerification = false) => {
    const phoneDigits = phone.replace(/\D/g, '');
    
    // Check if user has active session
    if (!skipVerification && !isPhoneVerified(phoneDigits)) {
      // User needs to verify - trigger verification flow
      setAppointmentsNeedsVerification(true);
      setAppointmentsVerified(false);
      
      // Generate and send verification code
      const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Create a temporary unverified booking entry for verification purposes
      // This allows us to use the unified verification system
      try {
        // First, check if there's already an unverified booking we can use
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('id, verification_code')
          .eq('customer_phone', phoneDigits)
          .eq('is_verified', false)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existingBookings && existingBookings.length > 0) {
          // Update existing booking with new verification code
          await supabase
            .from('bookings')
            .update({ verification_code: verificationCode })
            .eq('id', existingBookings[0].id);
        } else {
          // Create a temporary booking entry for verification
          const tempDate = new Date();
          tempDate.setDate(tempDate.getDate() + 1); // Tomorrow
          const tempDateStr = format(tempDate, 'yyyy-MM-dd');
          
          await supabase
            .from('bookings')
            .insert([{
              service_id: 'temp',
              service_title: 'אימות זמני',
              service_duration: 0,
              date: tempDateStr,
              start_time: '00:00',
              end_time: '00:00',
              customer_name: 'אימות',
              customer_phone: phoneDigits,
              verification_code: verificationCode,
              is_verified: false,
              status: 'pending',
              cancellation_token: uuidv4(),
            }]);
        }
        
        // Send SMS
        const smsResponse = await fetch('/api/sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: phoneDigits,
            code: verificationCode,
            customerName: 'לקוח',
          }),
        });
        
        if (!smsResponse.ok) {
          console.error('Failed to send SMS:', await smsResponse.text());
          alert('אירעה שגיאה בשליחת קוד האימות. נא לנסות שוב.');
          return;
        }
        
        setAppointmentsVerificationCode(verificationCode);
      } catch (error) {
        console.error('Error setting up verification:', error);
        alert('אירעה שגיאה בהגדרת האימות.');
        return;
      }
      
      return; // Don't fetch appointments yet, wait for verification
    }
    
    // User is verified - fetch appointments
    setLoadingAppointments(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_phone', phoneDigits)
        .in('status', ['pending', 'confirmed'])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching appointments:', error);
        alert('אירעה שגיאה בטעינת התורים. נא לנסות שוב.');
      } else {
        setMyAppointments(data || []);
        setAppointmentsVerified(true);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בטעינת התורים.');
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleSearchAppointments = () => {
    if (!isValidPhoneNumber(appointmentsPhone)) {
      alert('אנא הכנס מספר טלפון תקין');
      return;
    }
    fetchMyAppointments(appointmentsPhone);
  };

  const handleAppointmentsVerification = async () => {
    if (!appointmentsVerificationCode || appointmentsVerificationCode.length !== 4) {
      setAppointmentsVerificationError('אנא הכנס קוד אימות בן 4 ספרות');
      return;
    }

    setAppointmentsVerifying(true);
    setAppointmentsVerificationError('');

    try {
      const phoneDigits = appointmentsPhone.replace(/\D/g, '');
      
      // Use unified verification API
      const verifyResponse = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneDigits,
          code: appointmentsVerificationCode,
        }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyResult.verified) {
        setAppointmentsVerificationError('קוד אימות שגוי. נא לנסות שוב.');
        setAppointmentsVerifying(false);
        return;
      }

      // Create verified session
      createVerifiedSession(phoneDigits);
      
      // Now fetch appointments
      await fetchMyAppointments(phoneDigits, true);
      setAppointmentsNeedsVerification(false);
      setAppointmentsVerificationCode('');
    } catch (error: any) {
      console.error('Verification error:', error);
      setAppointmentsVerificationError('אירעה שגיאה בתהליך האימות. נא לנסות שוב.');
    } finally {
      setAppointmentsVerifying(false);
    }
  };

  const handleCancelAppointment = async (bookingId: string) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את התור?')) {
      return;
    }

    setCancellingAppointmentId(bookingId);
    try {
      // Fetch booking details first for activity log
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_name, date, start_time')
        .eq('id', bookingId)
        .single();

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) {
        console.error('Error cancelling appointment:', error);
        alert('אירעה שגיאה בביטול התור. נא לנסות שוב.');
      } else {
        // Add activity log entry
        if (booking && booking.date && booking.start_time) {
          const formattedDate = format(parseDateString(booking.date), 'dd/MM/yyyy');
          const formattedTime = booking.start_time.slice(0, 5); // HH:mm format
          await logActivity('cancel', `בוטל תור: ${booking.customer_name} שהיה קבוע ל-${formattedDate} בשעה ${formattedTime}`);
        } else if (booking) {
          await logActivity('cancel', `בוטל תור: ${booking.customer_name}`);
        }

        alert('התור בוטל בהצלחה');
        // Refresh the appointments list
        const phoneDigits = appointmentsPhone.replace(/\D/g, '');
        fetchMyAppointments(phoneDigits, true);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בביטול התור.');
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const formatDateString = (dateStr: string): string => {
    const date = parseDateString(dateStr);
    const hebrewMonths = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  };

  return (
    <div dir="rtl" className="min-h-screen">
      {/* My Appointments Button - Fixed Top Right */}
      <button
        onClick={() => {
          setShowMyAppointments(true);
          setMyAppointments([]);
          setAppointmentsPhone('');
          setAppointmentsVerified(false);
          setAppointmentsNeedsVerification(false);
          setAppointmentsVerificationCode('');
          setAppointmentsVerificationError('');
        }}
        className="fixed top-4 left-4 md:left-6 z-50 bg-[#c9a961] hover:bg-[#b8964f] text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 text-sm md:text-base font-medium flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        התורים שלי
      </button>

      {/* My Appointments Modal */}
      {showMyAppointments && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMyAppointments(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-[#c9a961] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">התורים שלי</h2>
              <button
                onClick={() => setShowMyAppointments(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {appointmentsNeedsVerification ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-[#2c2c2c]">
                      אימות נדרש
                    </p>
                    <p className="text-sm text-[#666666]">
                      נשלח קוד אימות למספר {appointmentsPhone}
                    </p>
                  </div>
                  
                  {/* Verification Code Input */}
                  <div className="space-y-2">
                    <label htmlFor="appointments-verification-code" className="block text-sm font-medium text-[#2c2c2c]">
                      קוד אימות
                    </label>
                    <input
                      id="appointments-verification-code"
                      type="text"
                      value={appointmentsVerificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setAppointmentsVerificationCode(value);
                        setAppointmentsVerificationError('');
                      }}
                      placeholder="0000"
                      className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200 text-center text-2xl tracking-widest"
                      dir="ltr"
                      maxLength={4}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAppointmentsVerification();
                        }
                      }}
                    />
                    {appointmentsVerificationError && (
                      <p className="text-sm text-red-600">{appointmentsVerificationError}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={handleAppointmentsVerification}
                    disabled={appointmentsVerifying || appointmentsVerificationCode.length !== 4}
                    className={`
                      w-full px-4 py-3 rounded-lg font-medium transition-all duration-200
                      ${appointmentsVerifying || appointmentsVerificationCode.length !== 4
                        ? 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed'
                        : 'bg-[#c9a961] hover:bg-[#b8964f] text-white'
                      }
                    `}
                  >
                    {appointmentsVerifying ? 'מאמת...' : 'אמת'}
                  </button>
                  
                  <button
                    onClick={() => {
                      setAppointmentsNeedsVerification(false);
                      setAppointmentsVerificationCode('');
                      setAppointmentsVerificationError('');
                    }}
                    className="w-full px-4 py-2 text-sm text-[#666666] hover:text-[#2c2c2c] transition-colors"
                  >
                    חזור
                  </button>
                </div>
              ) : myAppointments.length === 0 && !loadingAppointments ? (
                <div className="space-y-4">
                  {/* Phone Input */}
                  <div className="space-y-2">
                    <label htmlFor="appointments-phone" className="block text-sm font-medium text-[#2c2c2c]">
                      מספר טלפון
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="appointments-phone"
                        type="tel"
                        value={appointmentsPhone}
                        onChange={(e) => setAppointmentsPhone(e.target.value)}
                        placeholder="0501234567"
                        className="flex-1 border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
                        dir="ltr"
                        disabled={appointmentsVerified}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !appointmentsVerified) {
                            handleSearchAppointments();
                          }
                        }}
                      />
                      {!appointmentsVerified && (
                        <button
                          onClick={handleSearchAppointments}
                          className="px-6 py-3 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors"
                        >
                          חפש
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[#666666] text-center py-4">
                    {appointmentsVerified 
                      ? 'לא נמצאו תורים עבור מספר הטלפון הזה'
                      : 'הכנס את מספר הטלפון שלך כדי לראות את התורים שלך'
                    }
                  </p>
                </div>
              ) : loadingAppointments ? (
                <div className="text-center py-8 text-[#666666]">
                  טוען תורים...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Phone Display with Logout */}
                  <div className="bg-[#f5f5f5] rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-[#666666]">
                      תורים עבור: {appointmentsPhone}
                    </div>
                    <button
                      onClick={() => {
                        const phoneDigits = appointmentsPhone.replace(/\D/g, '');
                        clearAllSessions();
                        setMyAppointments([]);
                        setAppointmentsPhone('');
                        setAppointmentsVerified(false);
                        setAppointmentsNeedsVerification(false);
                        setAppointmentsVerificationCode('');
                        setAppointmentsVerificationError('');
                      }}
                      className="text-xs text-[#c9a961] hover:text-[#b8964f] transition-colors underline"
                      title="החלף משתמש"
                    >
                      החלף משתמש
                    </button>
                  </div>

                  {/* Appointments List */}
                  <div className="space-y-3">
                    {myAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="border border-[#e0e0e0] rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-start">
                            <span className="text-sm text-[#666666]">שירות:</span>
                            <span className="text-[#2c2c2c] font-medium text-right">{appointment.service_title}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-[#666666]">תאריך:</span>
                            <span className="text-[#2c2c2c] font-medium">{formatDateString(appointment.date)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-[#666666]">שעה:</span>
                            <span className="text-[#2c2c2c] font-medium">{appointment.start_time} - {appointment.end_time}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => appointment.id && handleCancelAppointment(appointment.id)}
                          disabled={cancellingAppointmentId === appointment.id}
                          className={`
                            w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm
                            ${cancellingAppointmentId === appointment.id
                              ? 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                            }
                          `}
                        >
                          {cancellingAppointmentId === appointment.id ? 'מבטל...' : 'ביטול תור'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {myAppointments.length === 0 && (
                    <p className="text-center text-[#666666] py-4">
                      לא נמצאו תורים עבור מספר הטלפון הזה
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {myAppointments.length > 0 && (
              <div className="border-t border-[#e0e0e0] p-4">
                <button
                  onClick={() => {
                    const phoneDigits = appointmentsPhone.replace(/\D/g, '');
                    clearAllSessions();
                    setMyAppointments([]);
                    setAppointmentsPhone('');
                    setAppointmentsVerified(false);
                    setAppointmentsNeedsVerification(false);
                    setAppointmentsVerificationCode('');
                    setAppointmentsVerificationError('');
                  }}
                  className="w-full px-4 py-2 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-lg font-medium transition-colors"
                >
                  החלף משתמש / התנתק
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero Section with Background */}
      <div className="relative w-full overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
        <Image
            src="/hero-bg.jpeg"
            alt="Adar Cosmetics Background"
            fill
          priority
            className="object-cover"
            quality={90}
          />
        </div>
        
        {/* Dark Overlay for Text Readability */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Fade Effect at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10" />
        
        {/* Hero Content */}
        <div className="relative px-4 py-12 md:py-16 flex flex-col items-center justify-center min-h-[60vh] md:min-h-[70vh]">
          {/* White Rounded Box with Logo/Name */}
          <div className="bg-white rounded-2xl shadow-xl px-8 py-10 md:px-12 md:py-14 mb-8 max-w-md w-full text-center">
            <h1 className="text-4xl md:text-5xl font-playfair font-medium tracking-[0.1em] text-[#2c2c2c] mb-4" style={{ fontFamily: 'var(--font-playfair)' }}>
              ADAR COSMETICS
          </h1>
            
            {/* Address with Map Pin Icon */}
            <div className="flex items-center justify-center gap-2 text-[#666666] text-sm md:text-base">
              <svg className="w-5 h-5 text-[#c9a961]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>מור 5, אור עקיבא</span>
            </div>
          </div>
          
          {/* Action Buttons - Circular Contact Buttons */}
          <div className="flex items-center justify-center gap-4 md:gap-6 relative z-20 pointer-events-auto">
            {/* WhatsApp Button */}
            <a
              href="https://wa.me/972508917748"
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#20BA5A] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110 active:scale-95"
              aria-label="WhatsApp"
            >
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>
            
            {/* Call Button */}
            <a
              href="tel:0508917748"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#c9a961] hover:bg-[#b8964f] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110 active:scale-95"
              aria-label="Call"
            >
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
            
            {/* Navigate Button - Waze */}
            <a
              href="https://waze.com/ul?q=מור 5, אור עקיבא"
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#33CCFF] hover:bg-[#2BB8E6] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110 active:scale-95"
              aria-label="Navigate with Waze"
            >
              <SiWaze className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </a>
            
            {/* Instagram Button */}
            <a
              href="https://www.instagram.com/adar_abergel_cosmetics?igsh=MWd5aXlyaDV4dHMwZA=="
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#E1306C] to-[#C13584] hover:from-[#C13584] hover:to-[#833AB4] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110 active:scale-95"
              aria-label="Instagram"
            >
              <Instagram className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </a>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8">

        {step === 'services' ? (
          <>
            {/* Services Section */}
            <div className="space-y-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  className={`
                    border rounded-lg bg-white p-6 md:p-8 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer
                    ${selectedService === service.id 
                      ? 'border-[#c9a961] border-2 shadow-md ring-2 ring-[#c9a961] ring-opacity-20' 
                      : 'border-[#e0e0e0] border'
                    }
                  `}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
                    <div className="space-y-2">
                      <h2 className="text-lg md:text-xl font-medium text-[#2c2c2c] leading-tight">{service.title}</h2>
                      <div className="flex items-center gap-3 md:gap-4 text-base md:text-sm font-medium text-[#2c2c2c]">
                        <span className="text-[#c9a961]">{service.price}</span>
                        <span className="text-[#cccccc]">•</span>
                        <span>{service.duration}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue Button */}
            <div className="flex justify-center">
              <button
                onClick={handleContinue}
                disabled={!selectedService}
                className={`
                  px-12 py-4 rounded-sm font-medium tracking-wide transition-all duration-200 uppercase text-sm
                  ${selectedService
                    ? 'bg-[#c9a961] hover:bg-[#b8964f] text-white cursor-pointer shadow-sm hover:shadow-md transform hover:scale-[1.02] opacity-100'
                    : 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed opacity-50'
                  }
                `}
              >
                המשך לבחירת זמן
              </button>
            </div>
          </>
        ) : step === 'calendar' ? (
          <>
            {/* Calendar Section */}
            <div className="space-y-8">
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="text-[#666666] hover:text-[#2c2c2c] transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                חזרה
              </button>

              {/* Selected Service Info */}
              {selectedServiceData && (
                <div className="border border-[#e0e0e0] rounded-lg bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-medium text-[#2c2c2c] mb-2">{selectedServiceData.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-[#666666]">
                    <span className="text-[#c9a961]">{selectedServiceData.price}</span>
                    <span>•</span>
                    <span>{selectedServiceData.duration}</span>
                  </div>
                </div>
              )}

              {/* Date Selection - Calendar */}
              <div className="space-y-4">
                <h2 className="text-xl font-medium text-[#2c2c2c]">בחר תאריך</h2>
                <div className="flex justify-center">
                  <style jsx global>{`
                    .rdp {
                      --rdp-cell-size: 40px;
                      --rdp-accent-color: #c9a961;
                      --rdp-background-color: #f5f5f5;
                      --rdp-outline: 2px solid var(--rdp-accent-color);
                      --rdp-outline-selected: 2px solid var(--rdp-accent-color);
                      margin: 0;
                      direction: rtl;
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
                      font-size: 0.875rem;
                      padding: 0.5rem;
                      color: #666666;
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
                      font-size: 0.875rem;
                      cursor: pointer;
                      transition: all 0.2s;
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
                      font-size: 1rem;
                      color: #2c2c2c;
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
                    selected={selectedDate || undefined}
                    onSelect={(date) => {
                      setSelectedDate(date || null);
                      setSelectedTime(null);
                    }}
                    disabled={disabledDates}
                    className="bg-white p-4 rounded-lg border border-[#e0e0e0]"
                  />
                </div>
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div className="space-y-4">
                  <h2 className="text-xl font-medium text-[#2c2c2c]">בחר שעה</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {loadingBookings ? (
                      <div className="col-span-2 text-center py-8 text-[#666666]">
                        טוען זמנים זמינים...
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-[#666666]">
                        אין זמנים זמינים לתאריך זה
                      </div>
                    ) : (
                      availableSlots.map((slot) => {
                        const isSelected = selectedTime === slot.key;
                        
                        return (
                          <button
                            key={slot.key}
                            onClick={() => setSelectedTime(slot.key)}
                            className={`
                              border rounded-lg p-4 text-center transition-all duration-200 font-medium
                              ${isSelected
                                ? 'border-[#c9a961] border-[3px] bg-[#c9a961] text-white shadow-md'
                                : 'border-[#e0e0e0] bg-white text-[#2c2c2c] hover:bg-[#f5f5f5] hover:border-[#c9a961] hover:shadow-sm'
                              }
                            `}
                          >
                            <span className={`text-sm md:text-base transition-colors duration-200 ${
                              isSelected 
                                ? 'text-white' 
                                : 'text-[#2c2c2c]'
                            }`}>
                              {slot.start} - {slot.end}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleConfirmBooking}
                  disabled={!selectedDate || !selectedTime}
                  className={`
                    px-12 py-4 rounded-sm font-medium tracking-wide transition-all duration-200 uppercase text-sm
                    ${selectedDate && selectedTime
                      ? 'bg-[#c9a961] hover:bg-[#b8964f] text-white cursor-pointer shadow-sm hover:shadow-md transform hover:scale-[1.02] opacity-100'
                      : 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  המשך
                </button>
              </div>
            </div>
          </>
        ) : step === 'contact' ? (
          <>
            {/* Contact Form Section */}
            <div className="space-y-8">
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="text-[#666666] hover:text-[#2c2c2c] transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                חזרה
              </button>

              {/* Booking Summary */}
              <div className="border border-[#e0e0e0] rounded-lg bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium text-[#2c2c2c] mb-4">סיכום התור</h3>
                {selectedServiceData && selectedDate && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">שירות:</span>
                      <span className="text-[#2c2c2c] font-medium">{selectedServiceData.title}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#666666]">תאריך:</span>
                      <span className="text-[#2c2c2c] font-medium">{formatDate(selectedDate)}</span>
                    </div>
                    {selectedTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#666666]">שעה:</span>
                        <span className="text-[#2c2c2c] font-medium">{getSelectedTimeSlotText()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Form */}
              <div className="space-y-6">
                <h2 className="text-xl font-medium text-[#2c2c2c]">פרטי יצירת קשר</h2>
                
                <div className="space-y-4">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-medium text-[#2c2c2c]">
                      שם מלא
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="הכנס שם מלא"
                      className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
                      dir="rtl"
                    />
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <label htmlFor="phone" className="block text-sm font-medium text-[#2c2c2c]">
                      מספר טלפון
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0501234567"
                      className="w-full border border-[#e0e0e0] rounded-lg px-4 py-3 text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200"
                      dir="ltr"
                    />
                    {customerPhone && !isValidPhoneNumber(customerPhone) && (
                      <p className="text-xs text-red-500">אנא הכנס מספר טלפון תקין</p>
                    )}
                  </div>
                </div>

                {/* WhatsApp Booking Button */}
                <div className="flex justify-center pt-4">
                  <button
                    onClick={handleWhatsAppBooking}
                    disabled={!isFormValid || savingBooking}
                    className={`
                      px-12 py-4 rounded-sm font-medium tracking-wide transition-all duration-200 uppercase text-sm
                      ${isFormValid && !savingBooking
                        ? 'bg-[#c9a961] hover:bg-[#b8964f] text-white cursor-pointer shadow-sm hover:shadow-md transform hover:scale-[1.02] opacity-100'
                        : 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    {savingBooking ? 'שומר תור...' : 'אישור וקביעת תור בוואטסאפ'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : step === 'verification' ? (
          <>
            {/* Verification Step */}
            <div className="space-y-8">
              {/* Back Button */}
              <button
                onClick={handleBack}
                className="text-[#666666] hover:text-[#2c2c2c] transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                חזרה
              </button>

              {/* Verification Form */}
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-md w-full">
                  <div className="space-y-6 text-center">
                    {/* Verification Icon */}
                    <div className="flex justify-center">
                      <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>

                    {/* Verification Message */}
                    <div className="space-y-3">
                      <h2 className="text-2xl md:text-3xl font-bold text-[#2c2c2c]">הזן את קוד האימות</h2>
                      <p className="text-base text-[#666666]">
                        קוד האימות נשלח אליך. אנא הכנס את הקוד לאימות התור.
                      </p>
                    </div>

                    {/* Verification Code Input */}
                    <div className="space-y-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setVerificationCode(value);
                          setVerificationError('');
                        }}
                        placeholder="0000"
                        className="w-full border-2 border-[#e0e0e0] rounded-lg px-6 py-4 text-center text-2xl font-bold text-[#2c2c2c] bg-white focus:outline-none focus:border-[#c9a961] focus:ring-2 focus:ring-[#c9a961] focus:ring-opacity-20 transition-all duration-200 tracking-widest"
                        dir="ltr"
                        autoFocus
                      />
                      {verificationError && (
                        <p className="text-sm text-red-500">{verificationError}</p>
                      )}
                    </div>

                    {/* Verify Button */}
                    <div className="pt-4">
                      <button
                        onClick={handleVerification}
                        disabled={verifying || verificationCode.length !== 4}
                        className={`
                          w-full px-10 py-4 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-base
                          ${verifying || verificationCode.length !== 4
                            ? 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed'
                            : 'bg-[#c9a961] hover:bg-[#b8964f] text-white'
                          }
                        `}
                      >
                        {verifying ? 'מאמת...' : 'אמת תור'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : step === 'success' ? (
          <>
            {/* Success Step */}
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-2xl shadow-xl p-8 md:p-12 max-w-lg w-full text-center">
                <div className="space-y-6">
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="w-20 h-20 bg-[#c9a961] rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Success Message */}
                  <div className="space-y-3">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#2c2c2c]">התור נקבע בהצלחה!</h2>
                    <p className="text-base md:text-lg text-[#666666] leading-relaxed px-2">
                      התור נקבע בהצלחה! ניתן לצפות בתור ולבטלו בכל עת דרך כפתור "התורים שלי" שבראש הדף.
                    </p>
                  </div>
                  
                  {/* Continue Button */}
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setStep('services');
                        setSelectedService(null);
                        setSelectedDate(null);
                        setSelectedTime(null);
                        setCustomerName('');
                        setCustomerPhone('');
                        setCancellationLink(null);
                      }}
                      className="px-10 py-4 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-base"
                    >
                      קבע תור נוסף
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
