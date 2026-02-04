
import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimeInputProps {
  value: string; // Format "HH:mm"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, disabled, className }) => {
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  
  // Track focus to prevent parent updates from clashing with typing
  const [isFocused, setIsFocused] = useState(false);
  
  // Refs for auto-focus navigation
  const hoursInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);

  // Sync from parent ONLY if not editing to avoid cursor jumping/overwriting
  useEffect(() => {
    if (!isFocused) {
      const [h, m] = (value || '00:00').split(':');
      setHours(h);
      setMinutes(m);
    }
  }, [value, isFocused]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    
    // Limits
    if (val.length > 2) val = val.slice(0, 2);
    if (parseInt(val) > 23) val = '23'; // Max 23h
    
    setHours(val);
    onChange(`${val}:${minutes}`); // Send raw value while typing

    // Auto-focus minutes if 2 digits typed
    if (val.length === 2) {
        minutesInputRef.current?.focus();
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    
    if (val.length > 2) val = val.slice(0, 2);
    if (parseInt(val) > 59) val = '59'; // Max 59m

    setMinutes(val);
    onChange(`${hours}:${val}`);
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Pad with zeros on blur for clean format
    const finalH = hours === '' ? '00' : hours.padStart(2, '0');
    const finalM = minutes === '' ? '00' : minutes.padStart(2, '0');

    setHours(finalH);
    setMinutes(finalM);
    onChange(`${finalH}:${finalM}`);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      e.target.select(); // Select all content for easier overwriting
  };

  return (
    <div 
      className={`flex items-center bg-navy-900 border rounded-lg px-3 py-2 transition-all duration-200 ${
        isFocused 
          ? 'border-primary ring-1 ring-primary' 
          : 'border-slate-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <Clock size={16} className={`mr-3 ${isFocused ? 'text-primary' : 'text-slate-500'}`} />
      
      <div className="flex items-center gap-1 w-full justify-center">
        <input
          ref={hoursInputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={hours}
          onChange={handleHoursChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="HH"
          className="w-8 bg-transparent text-center text-white placeholder-slate-600 focus:outline-none font-mono text-sm"
        />
        <span className="text-slate-500 font-bold">:</span>
        <input
          ref={minutesInputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={minutes}
          onChange={handleMinutesChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="MM"
          className="w-8 bg-transparent text-center text-white placeholder-slate-600 focus:outline-none font-mono text-sm"
        />
      </div>
    </div>
  );
};
