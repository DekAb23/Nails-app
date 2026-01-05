'use client';

import { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { supabase, Booking } from '@/lib/supabase';

type Step = 'services' | 'calendar' | 'contact' | 'success';

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
  
  // My Appointments Modal State
  const [showMyAppointments, setShowMyAppointments] = useState(false);
  const [appointmentsPhone, setAppointmentsPhone] = useState<string>('');
  const [myAppointments, setMyAppointments] = useState<Booking[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);

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
      title: "מבנה אנטומי - ג'ל בנייה (מורחב)",
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

  // Fetch bookings from Supabase when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchBookings(selectedDate);
    } else {
      setBookings([]);
    }
  }, [selectedDate]);

  const fetchBookings = async (date: Date) => {
    setLoadingBookings(true);
    try {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];
      
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

  // Check if a time slot conflicts with existing bookings
  const isTimeSlotBlocked = (slotStart: string, slotEnd: string): boolean => {
    return bookings.some(booking => {
      // Convert time strings to minutes for comparison
      const timeToMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const slotStartMinutes = timeToMinutes(slotStart);
      const slotEndMinutes = timeToMinutes(slotEnd);
      const bookingStartMinutes = timeToMinutes(booking.start_time);
      const bookingEndMinutes = timeToMinutes(booking.end_time);

      // Check for overlap: slot overlaps if it starts before booking ends AND ends after booking starts
      return slotStartMinutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes;
    });
  };

  // Hebrew day names
  const hebrewDays = ['א\'', 'ב\'', 'ג\'', 'ד\'', 'ה\'', 'ו\'', 'ש\''];
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  // Generate available dates (next 30 days, Sunday-Thursday only)
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      
      // Only include Sunday (0) through Thursday (4)
      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        dates.push(date);
      }
    }
    
    return dates;
  }, []);

  // Generate time slots based on selected service duration
  const timeSlots = useMemo(() => {
    if (!selectedServiceData || !selectedDate) return [];
    
    const slots: { start: string; end: string; key: string }[] = [];
    const startTimeMinutes = 9 * 60; // 09:00 in minutes
    const endTimeMinutes = 18 * 60; // 18:00 in minutes (1080 minutes)
    const duration = selectedServiceData.durationMinutes;
    
    // Generate back-to-back slots based on service duration
    let currentStart = startTimeMinutes;
    
    while (currentStart < endTimeMinutes) {
      const slotEnd = currentStart + duration;
      
      // Only include slot if it ends before or at 18:00
      if (slotEnd <= endTimeMinutes) {
        const formatTime = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        };
        
        const startTime = formatTime(currentStart);
        const endTime = formatTime(slotEnd);
        const key = `${startTime}-${endTime}`;
        
        slots.push({ start: startTime, end: endTime, key });
        
        // Next slot starts where this one ends
        currentStart = slotEnd;
      } else {
        // No more slots can fit
        break;
      }
    }
    
    return slots;
  }, [selectedServiceData, selectedDate]);

  const formatDate = (date: Date): string => {
    return `${date.getDate()} ${hebrewMonths[date.getMonth()]}`;
  };

  const formatDayOfWeek = (date: Date): string => {
    return hebrewDays[date.getDay()];
  };

  const getSelectedTimeSlotText = (): string => {
    if (!selectedTime) return '';
    const selectedSlot = timeSlots.find(slot => slot.key === selectedTime);
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
    } else if (step === 'success') {
      setStep('services');
      setSelectedService(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setCustomerName('');
      setCustomerPhone('');
      setCancellationLink(null);
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
      const selectedSlot = timeSlots.find(slot => slot.key === selectedTime);
      if (!selectedSlot) {
        throw new Error('Selected time slot not found');
      }

      // Format date as YYYY-MM-DD for database
      const dateStr = selectedDate.toISOString().split('T')[0];

      // Generate cancellation token
      const cancellationToken = uuidv4();

      // Prepare booking data
      const customerPhoneDigits = customerPhone.replace(/\D/g, '');
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

      // Refresh bookings to show the new booking
      await fetchBookings(selectedDate);

      // Move to success step
      setStep('success');
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

  // Fetch user's appointments by phone number
  const fetchMyAppointments = async (phone: string) => {
    setLoadingAppointments(true);
    try {
      const phoneDigits = phone.replace(/\D/g, '');
      
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

  const handleCancelAppointment = async (bookingId: string) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את התור?')) {
      return;
    }

    setCancellingAppointmentId(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) {
        console.error('Error cancelling appointment:', error);
        alert('אירעה שגיאה בביטול התור. נא לנסות שוב.');
      } else {
        alert('התור בוטל בהצלחה');
        // Refresh the appointments list
        const phoneDigits = appointmentsPhone.replace(/\D/g, '');
        fetchMyAppointments(phoneDigits);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('אירעה שגיאה בביטול התור.');
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const formatDateString = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
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
              {myAppointments.length === 0 && !loadingAppointments ? (
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchAppointments();
                          }
                        }}
                      />
                      <button
                        onClick={handleSearchAppointments}
                        className="px-6 py-3 bg-[#c9a961] hover:bg-[#b8964f] text-white rounded-lg font-medium transition-colors"
                      >
                        חפש
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-[#666666] text-center py-4">
                    הכנס את מספר הטלפון שלך כדי לראות את התורים שלך
                  </p>
                </div>
              ) : loadingAppointments ? (
                <div className="text-center py-8 text-[#666666]">
                  טוען תורים...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Phone Display */}
                  <div className="bg-[#f5f5f5] rounded-lg p-3 text-sm text-[#666666]">
                    תורים עבור: {appointmentsPhone}
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
                    setMyAppointments([]);
                    setAppointmentsPhone('');
                  }}
                  className="w-full px-4 py-2 border border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#2c2c2c] rounded-lg font-medium transition-colors"
                >
                  חיפוש חדש
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
            <h1 className="text-4xl md:text-5xl font-bold tracking-wide text-[#2c2c2c] mb-4">
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
          
          {/* Action Buttons - Three Circular Buttons */}
          <div className="flex items-center justify-center gap-4 md:gap-6">
            {/* WhatsApp Button */}
            <a
              href="https://wa.me/972508917748"
              target="_blank"
              rel="noopener noreferrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#20BA5A] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110"
              aria-label="WhatsApp"
            >
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </a>
            
            {/* Call Button */}
            <a
              href="tel:0508917748"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#c9a961] hover:bg-[#b8964f] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110"
              aria-label="Call"
            >
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
            
            {/* Navigate Button */}
            <a
              href="https://waze.com/ul?q=מור 5, אור עקיבא"
            target="_blank"
            rel="noopener noreferrer"
              className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#333333] hover:bg-[#252525] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center transform hover:scale-110"
              aria-label="Navigate"
            >
              <svg className="w-7 h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
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

              {/* Date Selection */}
              <div className="space-y-4">
                <h2 className="text-xl font-medium text-[#2c2c2c]">בחר תאריך</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableDates.map((date) => {
                    const isSelected = selectedDate?.getTime() === date.getTime();
                    return (
                      <button
                        key={date.getTime()}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedTime(null);
                        }}
                        className={`
                          border rounded-lg p-4 text-center transition-all duration-200
                          ${isSelected
                            ? 'border-[#c9a961] border-[3px] bg-[#c9a961] shadow-md'
                            : 'border-[#e0e0e0] bg-white hover:bg-[#f5f5f5] hover:border-[#c9a961] hover:shadow-sm'
                          }
                        `}
                      >
                        <div className={`text-xs mb-1 transition-colors duration-200 ${isSelected ? 'text-white' : 'text-[#666666]'}`}>
                          {formatDayOfWeek(date)}
                        </div>
                        <div className={`text-base font-medium transition-colors duration-200 ${isSelected ? 'text-white' : 'text-[#2c2c2c]'}`}>
                          {formatDate(date)}
                        </div>
                      </button>
                    );
                  })}
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
                    ) : timeSlots.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-[#666666]">
                        אין זמנים זמינים לתאריך זה
                      </div>
                    ) : (
                      timeSlots.map((slot) => {
                        const isSelected = selectedTime === slot.key;
                        const isBlocked = isTimeSlotBlocked(slot.start, slot.end);
                        
                        return (
                          <button
                            key={slot.key}
                            onClick={() => !isBlocked && setSelectedTime(slot.key)}
                            disabled={isBlocked}
                            className={`
                              border rounded-lg p-4 text-center transition-all duration-200 font-medium
                              ${isSelected
                                ? 'border-[#c9a961] border-[3px] bg-[#c9a961] text-white shadow-md'
                                : isBlocked
                                ? 'border-[#e0e0e0] bg-[#f5f5f5] text-[#b0b0b0] cursor-not-allowed opacity-50'
                                : 'border-[#e0e0e0] bg-white text-[#2c2c2c] hover:bg-[#f5f5f5] hover:border-[#c9a961] hover:shadow-sm'
                              }
                            `}
                          >
                            <span className={`text-sm md:text-base transition-colors duration-200 ${
                              isSelected 
                                ? 'text-white' 
                                : isBlocked 
                                ? 'text-[#b0b0b0]' 
                                : 'text-[#2c2c2c]'
                            }`}>
                              {slot.start} - {slot.end}
                              {isBlocked && ' (תפוס)'}
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
