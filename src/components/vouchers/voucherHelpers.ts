export const formatRelativeAge = (createdAt?: string, isRtl = false): string => {
  if (!createdAt) return '';
  const parsed = Date.parse(createdAt);
  if (isNaN(parsed)) return '';

  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return '';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return isRtl ? 'الآن' : 'just now';
  if (diffMin < 60) return isRtl ? `منذ ${diffMin} د` : `${diffMin}m ago`;

  const h = Math.floor(diffMin / 60);
  if (h < 24) return isRtl ? `منذ ${h} س` : `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 30) return isRtl ? `منذ ${d} يوم` : `${d}d ago`;

  const mo = Math.floor(d / 30);
  if (mo < 12) return isRtl ? `منذ ${mo} شهر` : `${mo}mo ago`;

  const y = Math.floor(d / 365);
  return isRtl ? `منذ ${y} سنة` : `${y}y ago`;
};
