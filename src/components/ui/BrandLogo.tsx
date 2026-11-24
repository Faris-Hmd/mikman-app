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
  const sizeClass = size <= 32 ? 'brand-logo-badge-32' : size <= 36 ? 'brand-logo-badge-36' : 'brand-logo-badge-56';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`brand-logo-badge ${sizeClass}`}>
        <ZapIcon size={iconSize} color="var(--white)" fill="var(--white)" strokeWidth="1.2" />
      </div>
      {showText && (
        <div className="flex flex-col text-start">
          <h1 className="brand-logo-title">
            {textTitle}
          </h1>
          {subtitle && (
            <span className="brand-logo-subtitle">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
