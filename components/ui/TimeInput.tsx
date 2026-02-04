import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

interface TimeInputProps {
  value: string; // Format "HH:mm"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, disabled, className }) => {
  // Parse initial value ensuring fallbacks
  const [initialH, initialM] = (value || '00:00').split(':');
  
  const [hours, setHours] = useState(initialH);
  const [minutes, setMinutes] = useState(initialM);
  const [isFocused, setIsFocused] = useState(false);

  // Sync internal state if external value changes (e.g. reset form)
  useEffect(() => {
    const [h, m] = (value || '00:00').split(':');
    setHours(h);
    setMinutes(m);
  }, [value]);

  const updateParent = (h: string, m: string) => {
    onChange(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // Only numbers
    if (val.length > 2) val = val.slice(0, 2);
    setHours(val);
    updateParent(val, minutes);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    
    // Clamp minutes to 59 logic is better handled on blur to allow typing, 
    // but strict validation prevents > 59 if first digit > 5
    if (parseInt(val) > 59) val = '59';
    
    setMinutes(val);
    updateParent(hours, val);
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    let finalH = hours === '' ? '00' : hours.padStart(2, '0');
    let finalM = minutes === '' ? '00' : minutes.padStart(2, '0');

    setHours(finalH);
    setMinutes(finalM);
    updateParent(finalH, finalM);
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
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={hours}
          onChange={handleHoursChange}
          onFocus={(e) => { setIsFocused(true); e.target.select(); }}
          onBlur={handleBlur}
          placeholder="HH"
          className="w-8 bg-transparent text-center text-white placeholder-slate-600 focus:outline-none font-mono text-sm"
        />
        <span className="text-slate-500 font-bold">:</span>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={minutes}
          onChange={handleMinutesChange}
          onFocus={(e) => { setIsFocused(true); e.target.select(); }}
          onBlur={handleBlur}
          placeholder="MM"
          className="w-8 bg-transparent text-center text-white placeholder-slate-600 focus:outline-none font-mono text-sm"
        />
      </div>
    </div>
  );
};