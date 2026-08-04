import React from 'react';
import ZapIcon from './ZapIcon';

interface BrandLogoProps {
  size?: number;
  iconSize?: number;
  showText?: boolean;
  textTitle?: string;
  subtitle?: string;
  className?: string;
}

export default function BrandLogo({
  size = 36,
  iconSize = 20,
  showText = false,
  textTitle = 'MIKMAN',
  subtitle,
  className = '',
}: BrandLogoProps) {
  const borderRadius = Math.max(8, Math.round(size * 0.28));

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: `${borderRadius}px`,
          backgroundColor: '#3B82F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.45)',
        }}
      >
        <ZapIcon size={iconSize} color="#ffffff" fill="#ffffff" strokeWidth="1.2" />
      </div>
      {showText && (
        <div className="flex flex-col text-start">
          <h1 className="text-[15px] font-[900] m-0 tracking-tight leading-tight" style={{ color: 'var(--foreground)' }}>
            {textTitle}
          </h1>
          {subtitle && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
