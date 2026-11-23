export const formatRelativeAge = (
  createdAt?: string,
  t?: (key: string, params?: Record<string, string | number>) => string
): string => {
  if (!createdAt) return '';
  const parsed = Date.parse(createdAt);
  if (isNaN(parsed)) return '';

  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return '';

  const diffMin = Math.floor(diffMs / 60000);
  if (!t) return `${diffMin}m ago`;

  if (diffMin < 1) return t('common.justNow');
  if (diffMin < 60) return t('common.mAgo', { m: diffMin });

  const h = Math.floor(diffMin / 60);
  if (h < 24) return t('common.hAgo', { h });

  const d = Math.floor(h / 24);
  if (d < 30) return t('common.dAgo', { d });

  const mo = Math.floor(d / 30);
  if (mo < 12) return t('common.moAgo', { mo });

  const y = Math.floor(d / 365);
  return t('common.yAgo', { y });
};
