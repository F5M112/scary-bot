'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Lock, AlertTriangle, LogOut, Mail } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function NoPlanPage() {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!user) {
      fetchUser().then((u) => {
        if (!u) router.replace('/login');
        else if (u.role === 'admin') router.replace('/admin');
        else if (u.hasPlan) router.replace('/dashboard');
      });
    } else if (user.role === 'admin') {
      router.replace('/admin');
    } else if (user.hasPlan) {
      router.replace('/dashboard');
    }
  }, [user, fetchUser, router]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="text-amber-400" size={20} />
          <span className="font-bold">{t('appName')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button onClick={logout} className="btn-secondary text-sm flex items-center gap-2">
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="card max-w-lg w-full text-center bg-gradient-to-br from-[#15151f] to-amber-950/20 border-amber-500/30">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="text-amber-400" size={40} />
          </div>

          <h1 className="text-2xl font-bold mb-3">{t('noPlan')}</h1>
          <p className="text-white/70 mb-2">
            {t('welcome')}, <span className="font-bold">{user.displayName || user.username}</span> 👋
          </p>
          <p className="text-white/60 mb-8 leading-relaxed">{t('noPlanDesc')}</p>

          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="text-xs text-white/50 mb-1">{t('currentPlan')}</div>
            <div className="font-bold text-amber-400 capitalize">{t('none')}</div>
          </div>

          <a href="mailto:admin@example.com" className="btn-primary w-full inline-flex items-center justify-center gap-2">
            <Mail size={16} /> {t('contactAdmin')}
          </a>

          <button onClick={logout} className="mt-3 text-sm text-white/50 hover:text-white">
            {t('logout')}
          </button>
        </div>
      </main>
    </div>
  );
}
