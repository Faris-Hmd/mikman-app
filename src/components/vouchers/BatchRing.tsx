import React from 'react';

interface BatchRingProps {
  originalCount: number;
  unusedCount: number;
  activeCount: number;
  expiredCount: number;
}

/** Compact SVG donut ring visualizing unused, active, and expired voucher ratios. */
export const BatchRing: React.FC<BatchRingProps> = ({
  originalCount,
  unusedCount,
  activeCount,
  expiredCount,
}) => {
  const total = Math.max(originalCount, unusedCount + activeCount + expiredCount, 1);
  const ringRadius = 15;
  const ringCirc = 2 * Math.PI * ringRadius;
  const unusedLen = (unusedCount / total) * ringCirc;
  const activeLen = (activeCount / total) * ringCirc;
  const expiredLen = (expiredCount / total) * ringCirc;
  const unusedPct = Math.round((unusedCount / total) * 100);

  return (
    <div className="batch-ring-wrap">
      <svg className="batch-ring-svg" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="batch-ring-track" cx={18} cy={18} r={ringRadius} />
        {unusedLen > 0 && (
          <circle
            className="batch-ring-seg unused"
            cx={18}
            cy={18}
            r={ringRadius}
            strokeDasharray={`${unusedLen} ${ringCirc}`}
            strokeDashoffset={0}
          />
        )}
        {activeLen > 0 && (
          <circle
            className="batch-ring-seg active"
            cx={18}
            cy={18}
            r={ringRadius}
            strokeDasharray={`${activeLen} ${ringCirc}`}
            strokeDashoffset={-unusedLen}
          />
        )}
        {expiredLen > 0 && (
          <circle
            className="batch-ring-seg expired"
            cx={18}
            cy={18}
            r={ringRadius}
            strokeDasharray={`${expiredLen} ${ringCirc}`}
            strokeDashoffset={-(unusedLen + activeLen)}
          />
        )}
      </svg>
      <span className="batch-ring-label">{unusedPct}%</span>
    </div>
  );
};
