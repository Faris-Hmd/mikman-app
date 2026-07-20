import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function PlansPage() {
  const { t } = useLanguage();
  return (
    <div style={{ padding: '24px' }}>
      <h2>Plans</h2>
    </div>
  );
}
