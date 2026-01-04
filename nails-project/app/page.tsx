'use client';

import { useState, useMemo } from 'react';

type Step = 'services' | 'calendar' | 'contact';

export default function Home() {
  const [step, setStep] = useState<Step>('services');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

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

  const handleWhatsAppBooking = () => {
    if (!selectedServiceData || !selectedDate || !selectedTime || !customerName || !isFormValid) {
      return;
    }

    // Format date for message
    const formattedDate = formatDate(selectedDate);
    
    // Get time slot text
    const timeText = getSelectedTimeSlotText();
    
    // Create WhatsApp message
    const message = `היי אדר, אני רוצה לקבוע תור ל${selectedServiceData.title} בתאריך ${formattedDate} בשעה ${timeText}. שמי: ${customerName}.`;
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    
    // WhatsApp phone number (placeholder)
    const phoneNumber = '0501234567';
    
    // Open WhatsApp
    const whatsappUrl = `https://wa.me/972${phoneNumber.slice(1)}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 py-16">
      <main className="w-full max-w-2xl space-y-16">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-[#2c2c2c]">
            Adar Cosmetics
          </h1>
          <p className="text-lg md:text-xl text-[#4a4a4a] font-light tracking-wide">
            אמנות וטיפוח הציפורן ברמה הגבוהה ביותר
          </p>
        </div>

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
                    {timeSlots.map((slot) => {
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
                          <span className={`text-sm md:text-base transition-colors duration-200 ${isSelected ? 'text-white' : 'text-[#2c2c2c]'}`}>
                            {slot.start} - {slot.end}
                          </span>
                        </button>
                      );
                    })}
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
        ) : (
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
                    disabled={!isFormValid}
                    className={`
                      px-12 py-4 rounded-sm font-medium tracking-wide transition-all duration-200 uppercase text-sm
                      ${isFormValid
                        ? 'bg-[#c9a961] hover:bg-[#b8964f] text-white cursor-pointer shadow-sm hover:shadow-md transform hover:scale-[1.02] opacity-100'
                        : 'bg-[#e8e8e8] text-[#b0b0b0] cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    אישור וקביעת תור בוואטסאפ
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
