import React from 'react';

interface ZapIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number | string;
}

export function ZapIcon({
  size = 20,
  color = '#ffffff',
  fill = '#ffffff',
  strokeWidth = '1.2',
  style,
  className = '',
  ...props
}: ZapIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeMiterlimit="10"
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
      {...props}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export default ZapIcon;
