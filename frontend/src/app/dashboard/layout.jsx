'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  Megaphone, Bot, CreditCard, LogOut,
  Loader2, Crown, Menu, X, LayoutDashboard, Ticket, Radio, Bookmark, Gift,
} from 'lucide-react';
import Logo from '@/components/Logo';

export default function DashboardLayout({ children }) {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { href: '/dashboard/kick',         label: 'Kick Live',      icon: Radio },
    { href: '/dashboard/adhkar',       label: 'الأذكار',         icon: Bookmark },
    { href: '/dashboard/broadcast',    label: t('broadcast'),   icon: Megaphone },
    { href: '/dashboard/bot',          label: t('botSettings'), icon: Bot,       premium: true },
    { href: '/dashboard/subscription', label: t('subscription'),icon: CreditCard },
  ];

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  const isRTL = lang === 'ar';

  // Sidebar position based on language direction (using inline style for reliability)
  const sidebarStyle = {
    [isRTL ? 'right' : 'left']: 0,
    transform: sidebarOpen
      ? 'translateX(0)'
      : (typeof window !== 'undefined' && window.innerWidth >= 1024)
        ? 'translateX(0)'
        : isRTL ? 'translateX(100%)' : 'translateX(-100%)',
  };

  return (
    <div className="min-h-screen flex">
      <aside
        className="dashboard-sidebar fixed lg:sticky top-0 h-screen w-64 bg-[#0f0f17] z-40 flex flex-col transition-transform duration-300"
        style={{
          [isRTL ? 'right' : 'left']: 0,
          [isRTL ? 'borderLeft' : 'borderRight']: '1px solid rgba(255,255,255,0.05)',
        }}
        data-open={sidebarOpen}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold">ST Bot</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/60">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const isLocked = item.premium && user.plan !== 'premium';
            return (
              <Link
                key={item.href}
                href={isLocked ? '/dashboard/subscription' : item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${active ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'}
                `}
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
                {isLocked && <Crown size={14} className="text-purple-400" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <LanguageSwitcher className="w-full justify-center" />
          <div className="flex items-center gap-3 p-2">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center font-bold">
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
          <button onClick={logout} className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2">
            <LogOut size={14} />
            {t('logout')}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 min-w-0">
        <div className="lg:hidden p-4 border-b border-white/5 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu size={24} />
          </button>
          <Logo size={28} showText textClassName="text-sm" />
          <LanguageSwitcher />
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
