'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  Megaphone, Bot, CreditCard, LogOut,
  Loader2, Crown, Menu, X, LayoutDashboard,
  Ticket, Radio, Bookmark, Gift,
} from 'lucide-react';
import Logo from '@/components/Logo';

export default function DashboardLayout({ children }) {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const pathname = usePathname();
  const router   = useRouter();
  const t        = useT();
  const lang     = useI18n((s) => s.lang);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isRTL = lang === 'ar';

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Close sidebar on ESC key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user) {
      fetchUser().then((u) => {
        if (!u) router.replace('/login');
        else if (u.role === 'admin') router.replace('/admin');
        else if (!u.hasPlan) router.replace('/no-plan');
      });
    } else if (user.role === 'admin') {
      router.replace('/admin');
    } else if (!user.hasPlan) {
      router.replace('/no-plan');
    }
  }, [user, fetchUser, router]);

  if (loading || !user || !user.hasPlan || user.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-500" size={40} />
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard',              label: t('home'),        icon: LayoutDashboard },
    { href: '/dashboard/tickets',      label: t('tickets'),     icon: Ticket },
    { href: '/dashboard/giveaway',     label: 'المسابقات',       icon: Gift },
    { href: '/dashboard/kick',         label: 'Social Media',   icon: Radio },
    { href: '/dashboard/adhkar',       label: 'الأذكار',         icon: Bookmark },
    { href: '/dashboard/broadcast',    label: t('broadcast'),   icon: Megaphone },
    { href: '/dashboard/bot',          label: t('botSettings'), icon: Bot, premium: true },
    { href: '/dashboard/subscription', label: t('subscription'),icon: CreditCard },
  ];

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();

  // Sidebar transform based on state + screen size
  const sidebarTransform = sidebarOpen
    ? 'translateX(0)'
    : isRTL
      ? 'translateX(100%)'
      : 'translateX(-100%)';

  return (
    <div className="min-h-screen flex">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        style={{
          position:  'fixed',
          top:       0,
          [isRTL ? 'right' : 'left']: 0,
          height:    '100vh',
          width:     '256px',
          zIndex:    40,
          transform: sidebarTransform,
          transition:'transform 0.3s ease',
          display:   'flex',
          flexDirection: 'column',
          background: '#0f0f17',
          borderLeft: isRTL ? 'none' : '1px solid rgba(255,255,255,0.05)',
          borderRight: isRTL ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold">ST Bot</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-white/60 hover:text-white p-1"
            aria-label="إغلاق القائمة"
          >
            <X size={22} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active   = pathname === item.href;
            const isLocked = item.premium && user.plan !== 'premium';
            return (
              <Link
                key={item.href}
                href={isLocked ? '/dashboard/subscription' : item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${active
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {isLocked && <Crown size={14} className="text-yellow-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <LanguageSwitcher className="w-full justify-center" />
          <div className="flex items-center gap-3 p-2">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center font-bold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.displayName || user.username}</div>
              <div className="text-xs">
                {user.plan === 'premium'
                  ? <span className="badge-premium text-[10px] px-2 py-0.5">{t('premium')}</span>
                  : <span className="text-white/50">{t('classic')}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2"
          >
            <LogOut size={14} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* ── Overlay (mobile only) ────────────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.6)',
            zIndex:     39,
          }}
        />
      )}

      {/* ── Desktop spacer (pushes content right/left of sidebar) */}
      <div
        className="hidden lg:block shrink-0"
        style={{ width: '256px' }}
      />

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/5"
          style={{ position: 'sticky', top: 0, zIndex: 30, background: '#0a0505' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
            aria-label="فتح القائمة"
          >
            <Menu size={24} />
          </button>
          <Logo size={28} showText textClassName="text-sm" />
          <LanguageSwitcher />
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
