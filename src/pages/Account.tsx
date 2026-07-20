import { useLanguage } from '../context/LanguageContext';

export default function AccountPage() {
  const { t } = useLanguage();
  return (
    <div style={{ padding: '24px' }}>
      <h2>{t('account.title')}</h2>
      <p>{t('account.subtitle')}</p>
    </div>
  );
}