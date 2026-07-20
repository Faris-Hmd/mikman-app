import { useState, useEffect } from 'react';

export function useSpeedUnit() {
  const [unit, setUnitState] = useState<'bits' | 'bytes'>('bits');

  useEffect(() => {
    const stored = localStorage.getItem('speed_unit');
    if (stored === 'bytes' || stored === 'bits') {
      setUnitState(stored);
    }

    const handleUpdate = () => {
      const current = localStorage.getItem('speed_unit');
      if (current === 'bytes' || current === 'bits') {
        setUnitState(current);
      }
    };

    window.addEventListener('speedUnitChanged', handleUpdate);
    return () => {
      window.removeEventListener('speedUnitChanged', handleUpdate);
    };
  }, []);

  const setUnit = (newUnit: 'bits' | 'bytes') => {
    localStorage.setItem('speed_unit', newUnit);
    setUnitState(newUnit);
    window.dispatchEvent(new Event('speedUnitChanged'));
  };

  return [unit, setUnit] as const;
}