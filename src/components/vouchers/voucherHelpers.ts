import type { VoucherBatch } from '../../api';
import type { Profile } from './types';

export const formatBatchAge = (
  batchId?: string,
  comment?: string,
  createdAt?: string,
  isRtl = false
): string => {
  let ts: number | null = null;

  if (createdAt) {
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) ts = parsed;
  }

  if (!ts && batchId) {
    const match = batchId.match(/(?:batch|b)_(\d{10,13})/i);
    if (match) {
      const rawNum = parseInt(match[1], 10);
      ts = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
    }
  }

  if (!ts) return '';

  const diffMs = Date.now() - ts;
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

export const getCleanComment = (comment?: string, cleanComment?: string): string => {
  if (cleanComment !== undefined && cleanComment !== '') return cleanComment;
  if (!comment) return '';
  const parts = comment.split(' | ').filter((p) => {
    const u = p.trim().toUpperCase();
    return (
      !u.startsWith('BATCH') &&
      !u.startsWith('PRINT_LABEL') &&
      !u.startsWith('BATCH_ID') &&
      !u.startsWith('DATE') &&
      !u.startsWith('CREATED') &&
      !u.startsWith('LOGIN') &&
      !u.startsWith('EXP')
    );
  });
  return parts.join(' | ').trim();
};

export const formatBytes = (bytesVal?: string | number): string => {
  if (!bytesVal && bytesVal !== 0) return '0 B';
  const bytes = typeof bytesVal === 'number' ? bytesVal : parseInt(String(bytesVal), 10);
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};

export const formatPriceBadge = (priceVal: string | number | null | undefined): string => {
  if (priceVal == null || priceVal === '') return '';
  const price = Number(priceVal);
  if (isNaN(price)) return String(priceVal);
  if (price >= 1000) {
    const kVal = price / 1000;
    return `${kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(price);
};

export const getProfileInfoDetails = (
  pName: string,
  profilesList: Profile[],
  batch?: VoucherBatch
) => {
  if (!pName) {
    return {
      price: null,
      validity: null,
      dataLimit: null,
      rateLimit: null,
      validityBadge: '∞',
      dataBadge: '∞',
      statsSummary: '∞ · ∞',
    };
  }

  let price: string | null = null;
  let validity: string | null = null;
  let dataLimit: string | null = null;
  let rateLimit: string | null = null;

  if (batch) {
    if (batch.price != null) price = String(batch.price);
    else if (batch.revenue != null) price = String(batch.revenue);

    if (batch.validity) validity = batch.validity;

    const mb = batch.dataLimitMB !== undefined ? batch.dataLimitMB : batch.limitMB;
    if (mb !== undefined && mb !== null) {
      dataLimit =
        mb === 0
          ? 'Unlimited'
          : mb >= 1024
            ? `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`
            : `${mb} MB`;
    }

    if (batch.rateLimit) rateLimit = batch.rateLimit;
  }

  // Fallback to profile list if batch did not provide it
  if (!price || !validity || !dataLimit) {
    const target = pName.toString().trim().toLowerCase();
    const p = profilesList.find(
      (prof) => (prof.name || prof.id || '').toString().trim().toLowerCase() === target
    );
    if (p) {
      if (!price && p.revenue != null && p.revenue !== '') price = String(p.revenue);
      if (!price && p.price != null && p.price !== '') price = String(p.price);
      if (!validity && p.validity) validity = p.validity;
      if (!dataLimit && p.limitMB !== undefined && p.limitMB !== null) {
        dataLimit =
          p.limitMB === 0
            ? 'Unlimited'
            : p.limitMB >= 1024
              ? `${(p.limitMB / 1024).toFixed(1).replace(/\.0$/, '')} GB`
              : `${p.limitMB} MB`;
      }
      if (!rateLimit && p['rate-limit']) rateLimit = String(p['rate-limit']);
    }
  }

  const isUnlTime =
    !validity ||
    validity.toLowerCase() === 'unlimited' ||
    validity.toLowerCase() === '0d' ||
    validity === '0' ||
    validity.toLowerCase() === '0h';
  const validityBadge = isUnlTime || !validity ? '∞' : validity.toUpperCase();

  const isUnlData =
    !dataLimit ||
    dataLimit.toLowerCase() === 'unlimited' ||
    dataLimit.toUpperCase() === '0 MB' ||
    dataLimit.toUpperCase() === '0MB';
  const dataBadge = isUnlData || !dataLimit ? '∞' : dataLimit.toUpperCase();

  const statsSummary = `${validityBadge} · ${dataBadge}`;

  return { price, validity, dataLimit, rateLimit, validityBadge, dataBadge, statsSummary };
};
