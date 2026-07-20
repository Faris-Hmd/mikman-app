import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function RegisterRouterPage() {
  const { t } = useLanguage();
  return (
    <div style={{ padding: '24px' }}>
      <h2>{t('registerRouter.title')}</h2>
      <p>{t('registerRouter.subtitle')}</p>
    </div>
  );
}
