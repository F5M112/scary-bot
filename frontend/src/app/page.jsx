'use client';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Crown } from 'lucide-react';
import { useT, useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';

const FEATURES = [
  { emoji: '🎫', key: 'tickets',   descKey: 'ticketsDesc' },
  { emoji: '🎉', key: 'giveaway',  descKey: 'giveawayDescShort' },
  { emoji: '📿', key: 'adhkar',    descKey: 'adhkarDescShort' },
  { emoji: '👋', key: 'welcome',  descKey: 'kickDescShort' },
  { emoji: '📢', key: 'broadcast', descKey: 'broadcastDescShort' },
  { emoji: '🤖', key: 'customBot', descKey: 'customBotDescShort' },
];

const FEATURE_LABELS = {
  ar: {
    tickets:          'نظام التذاكر',
    ticketsDesc:      'لوحات تذاكر مخصصة بأزرار وقوائم، أدوار موظفين، تصدير محادثات.',
    giveaway:         'المسابقات',
    giveawayDescShort:'أنشئ مسابقات بجوائز وسحب عشوائي تلقائي للفائزين.',
    adhkar:           'الأذكار التلقائية',
    adhkarDescShort:  'إرسال أذكار وأدعية إسلامية تلقائياً على فترات منتظمة.',
    welcome:         'نظام الترحيب',
    kickDescShort:    'تنبيهات فورية عند بدء البث او نزول مقطع على اشهر منصات التواصل الاجتماعي .',
    broadcast:        'الإذاعة الجماعية',
    broadcastDescShort:'أرسل رسائل DM لكل الأعضاء أو قائمة مستهدفة.',
    customBot:        'بوت مخصص',
    customBotDescShort:'ربط بوتك الخاص بتوكن خاص (باقة بريميوم).',
  },
  en: {
    tickets:          'Ticket System',
    ticketsDesc:      'Custom panels with buttons/dropdowns, staff roles, transcript export.',
    giveaway:         'Giveaways',
    giveawayDescShort:'Create giveaways with automatic random winner selection.',
    adhkar:           'Islamic Reminders',
    adhkarDescShort:  'Auto-send Islamic dhikr and duas at regular intervals.',
    welcome:         'Welcome system',
    kickDescShort:    'Instant notifications when streamers go live or upload content on social media platforms.',
    broadcast:        'Mass Broadcast',
    broadcastDescShort:'Send DMs to all members or a targeted list.',
    customBot:        'Custom Bot',
    customBotDescShort:'Connect your own bot token for a dedicated bot (Premium).',
  },
};

export default function HomePage() {
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const fl   = FEATURE_LABELS[lang] || FEATURE_LABELS.ar;

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="border-b border-white/5 backdrop-blur-md sticky top-0 z-50 bg-black/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={36} />
            <span className="text-xl font-black">ST Bot</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/login" className="btn-primary">{t('login')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Logo size={110} />
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-green-400 rounded-full animate-pulse border-2 border-black" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 bg-brand-600/20 border border-brand-500/30 rounded-full text-brand-300 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
          ST Bot — {lang === 'ar' ? 'بوت ديسكورد متكامل' : 'All-in-One Discord Bot'}
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-4 leading-tight">
          {t('heroTitle')}
          <br />
          <span className="bg-gradient-to-l from-brand-500 via-orange-400 to-brand-700 bg-clip-text text-transparent">
            {t('heroSubtitle')}
          </span>
        </h1>

        <p className="text-lg text-white/70 max-w-2xl mx-auto mb-8 leading-relaxed">
          {t('heroDescription')}
        </p>

        <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3">
          {t('getStarted')}
          <Arrow size={20} />
        </Link>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">{t('mainFeatures')}</h2>
        <p className="text-white/50 text-center mb-12">
          {lang === 'ar' ? 'كل شيء تحتاجه في بوت واحد' : 'Everything you need in one bot'}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.key} className="card hover:border-brand-500/30 transition group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">
                {f.emoji}
              </div>
              <h3 className="text-lg font-bold mb-2">{fl[f.key]}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{fl[f.descKey]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">{t('plans')}</h2>
        <p className="text-white/60 text-center mb-12">{t('chooseYourPlan')}</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Classic */}
          <div className="card hover:border-brand-500/30 transition">
            <div className="badge-classic inline-block mb-4">{t('classic')}</div>
            <div className="mb-5">
              <span className="text-4xl font-black">$10</span>
              <span className="text-white/50">{t('perMonth')}</span>
            </div>
            <ul className="space-y-2 mb-8">
              {(lang === 'ar' ? [
                'نظام التذاكر الكامل',
                'مسابقة واحدة ',
                'الأذكار التلقائية',
				'نظام الترحيب',
                'الإذاعة الشاملة (لكل الأعضاء)',
                'البوت الرئيسي',
              ] : [
                'Full Ticket System',
                'One giveaway',
                'Welcome system',
                'Auto Islamic Reminders',
                'Global Broadcast',
                'Platform Bot',
              ]).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="text-green-400 shrink-0" size={16} />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="btn-secondary w-full text-center block">{t('getStarted')}</Link>
          </div>

          {/* Premium */}
          <div className="card border-brand-500/40 relative bg-gradient-to-br from-[#15090a] to-brand-950/40 glow-red">
            <div className="absolute -top-3 ltr:right-6 rtl:left-6 badge-premium flex items-center gap-1">
              <Crown size={12} /> {t('mostPopular')}
            </div>
            <div className="text-brand-400 font-bold mb-4">{t('premium')}</div>
            <div className="mb-5">
              <span className="text-4xl font-black">$25</span>
              <span className="text-white/50">{t('perMonth')}</span>
            </div>
            <ul className="space-y-2 mb-8">
              {(lang === 'ar' ? [
                ['كل مميزات الكلاسيك', true],
                ['مسابقات لا محدودة', true],
                ['الإذاعة المستهدفة بمعرفات', true],
                ['بوت مخصص (توكن خاص)', true],
              ] : [
                ['All Classic Features', true],
                ['Unlimited Giveaways', true],
                ['Targeted Broadcast by IDs', true],
                ['Custom Bot (own token)', true],
              ]).map(([f, highlight], i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="text-brand-400 shrink-0" size={16} />
                  <span className={i === 0 ? 'font-medium' : 'text-white/80'}>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="btn-primary w-full text-center block bg-gradient-to-l from-brand-600 to-orange-600">
              {t('subscribe')}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-white/40 text-sm">
        <div className="flex justify-center mb-3">
          <Logo size={32} />
        </div>
        © 2026 Scary Store — {lang === 'ar' ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
      </footer>
    </div>
  );
}
