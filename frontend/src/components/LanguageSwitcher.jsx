'use client';
import { useI18n } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ className = '' }) {
  const { lang, toggleLang } = useI18n();
  return (
    <button
      onClick={toggleLang}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition ${className}`}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe size={16} />
      <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}
