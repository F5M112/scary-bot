'use client';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

export default function DirHandler() {
  const lang = useI18n((s) => s.lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  return null;
}
