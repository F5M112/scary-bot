'use client';
import { useEffect, useState } from 'react';
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

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

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
    { href: '/dashboard/giveaway',     label: lang === 'ar' ? 'المسابقات' : 'Giveaways', icon: Gift },
    { href: '/dashboard/welcome',         label: lang === 'ar' ? 'الترحيب' : 'Welcome', icon: Radio },
    { href: '/dashboard/adhkar',       label: lang === 'ar' ? 'الأذكار' : 'Adhkar', icon: Bookmark },
    { href: '/dashboard/broadcast',    label: t('broadcast'),   icon: Megaphone },
    { href: '/dashboard/bot',          label: t('botSettings'), icon: Bot, premium: true },
    { href: '/dashboard/subscription', label: t('subscription'),icon: CreditCard },
  ];

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ════ DESKTOP SIDEBAR (always visible on lg+) ════ */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#0f0f17] border-r border-white/5 sticky top-0 h-screen">
        <SidebarContent
          navItems={navItems}
          pathname={pathname}
          user={user}
          t={t}
          logout={logout}
          initial={initial}
          showClose={false}
          onClose={() => {}}
        />
      </aside>

      {/* ════ MOBILE SIDEBAR (overlay, hidden by default) ════ */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 998,
            }}
          />
          {/* Drawer */}
          <aside
            style={{
              position: 'fixed',
              top: 0,
              [isRTL ? 'right' : 'left']: 0,
              height: '100vh',
              width: '256px',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              background: '#0f0f17',
              borderLeft: isRTL ? 'none' : '1px solid rgba(255,255,255,0.05)',
              borderRight: isRTL ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <SidebarContent
              navItems={navItems}
              pathname={pathname}
              user={user}
              t={t}
              logout={logout}
              initial={initial}
              showClose={true}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ════ MAIN CONTENT ════ */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Mobile header */}
        <div
          className="lg:hidden"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: '#0a0505',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ color: 'white', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
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

// ── Sidebar content (reused for desktop + mobile) ─────────────────
function SidebarContent({ navItems, pathname, user, t, logout, initial, showClose, onClose }) {
  return (
    <>
      {/* Logo row */}
      <div style={{
        padding: '24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Logo size={28} />
          <span style={{ fontWeight: 'bold', color: 'white' }}>ST Bot</span>
        </Link>
        {showClose && (
          <button
            onClick={onClose}
            style={{
              color: 'rgba(255,255,255,0.6)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={22} />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const active   = pathname === item.href;
          const isLocked = item.premium && user.plan !== 'premium';
          return (
            <Link
              key={item.href}
              href={isLocked ? '/dashboard/subscription' : item.href}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: active ? '#fca5a5' : 'rgba(255,255,255,0.7)',
                background: active ? 'rgba(220,38,38,0.15)' : 'transparent',
                border: active ? '1px solid rgba(220,38,38,0.3)' : '1px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <item.icon size={18} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isLocked && <Crown size={14} style={{ color: '#facc15' }} />}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <LanguageSwitcher className="w-full justify-center" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px' }}>
          <div style={{
            width: '36px', height: '36px',
            borderRadius: '50%',
            background: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', color: 'white', flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName || user.username}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              {user.plan === 'premium' ? '⭐ بريميوم' : 'كلاسيك'}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer',
            fontSize: '14px', width: '100%',
          }}
        >
          <LogOut size={14} />
          {t('logout')}
        </button>
      </div>
    </>
  );
}
