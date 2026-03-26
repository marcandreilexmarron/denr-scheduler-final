import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, value, onChange, style }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div ref={selectRef} style={{ position: 'relative', ...style }}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{
          padding: '10px 14px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--card)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          boxShadow: isOpen ? '0 0 0 2px var(--primary)' : 'none',
        }}
      >
        {selectedOption ? selectedOption.label : 'Select...'}
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--card)',
          zIndex: 10,
          marginTop: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          animation: 'fadeInScale 0.2s ease-out',
        }}>
          {options.map(option => (
            <div 
              key={option.value} 
              onClick={() => handleSelect(option.value)} 
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: option.value === value ? 'var(--primary-light)' : 'var(--card)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = option.value === value ? 'var(--primary-light)' : 'var(--bg)'}
              onMouseLeave={(e) => e.currentTarget.style.background = option.value === value ? 'var(--primary-light)' : 'var(--card)'}
            >
              {option.label}
              {option.value === value && 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              }
            </div>
          ))}
        </div>
      )}
      <style>
        {`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};

export default CustomSelect;
