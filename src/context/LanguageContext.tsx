import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const storedLang = localStorage.getItem('@app_lang') as Language;
    if (storedLang === 'en' || storedLang === 'ar') {
      setLanguageState(storedLang);
    } else {
      const browserLang = navigator.language.split('-')[0];
      if (browserLang === 'ar') {
        setLanguageState('ar');
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('@app_lang', lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let result: any = translations[language];

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        let engFallback: any = translations['en'];
        for (const ek of keys) {
          if (engFallback && typeof engFallback === 'object' && ek in engFallback) {
            engFallback = engFallback[ek];
          } else {
            engFallback = null;
            break;
          }
        }
        if (typeof engFallback === 'string') {
          result = engFallback;
        } else {
          return key;
        }
        break;
      }
    }

    if (typeof result !== 'string') {
      return key;
    }

    let text = result;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return text;
  };

  const isRtl = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}