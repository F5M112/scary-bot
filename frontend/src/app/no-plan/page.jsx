'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { Lock, LogOut, Crown, Check, X, CreditCard, Loader2, CheckCircle } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function NoPlanPage() {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router   = useRouter();
  const t        = useT();
  const lang     = useI18n((s) => s.lang);
  const [plans, setPlans]   = useState([]);
  const [paying, setPaying] = useState('');

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

  useEffect(() => {
    // Check payment callback
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const planId  = params.get('plan');

    if (payment === 'success' && planId) {
      api.post('/subscription/verify', { paymentId: 'latest', planId })
        .then(() => {
          fetchUser();
          router.replace('/dashboard');
        })
        .catch(() => {
          router.replace('/dashboard');
        });
      window.history.replaceState({}, '', '/no-plan');
    } else if (payment === 'failed') {
      window.history.replaceState({}, '', '/no-plan');
    }

    // Load plans
    api.get('/subscription/plans').then(({ data }) => setPlans(data.plans));
  }, []);

  const handleCheckout = async (planId) => {
    setPaying(planId);
    try {
      const { data } = await api.post('/subscription/checkout', { planId });
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch {
      setPaying('');
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a12]">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-2xl">🤖</div>
          <span className="font-bold text-white">ST Bot</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button onClick={logout} className="btn-secondary text-sm flex items-center gap-2">
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Welcome */}
        <div className="text-center mb-10 mt-6">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-3xl font-bold mb-2">
            {lang === 'ar' ? `مرحباً، ${user.displayName || user.username}!` : `Welcome, ${user.displayName || user.username}!`}
          </h1>
          <p className="text-white/60 text-lg">
            {lang === 'ar'
              ? 'اختر باقتك للبدء في استخدام ST Bot'
              : 'Choose your plan to start using ST Bot'}
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {plans.map(plan => {
            const isPremium = plan.id === 'premium';
            const isLoading = paying === plan.id;

            return (
              <div key={plan.id}
                className={`card relative ${isPremium ? 'border-red-500/40 bg-gradient-to-br from-[#15151f] to-red-950/20' : 'border-white/10'}`}>

                {plan.popular && (
                  <div className="absolute -top-3 right-6 bg-red-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                    <Crown size={10} /> {t('mostPopular')}
                  </div>
                )}

                <div className={`text-xl font-bold mb-1 ${isPremium ? 'text-red-400' : 'text-blue-400'}`}>
                  {lang === 'ar' ? plan.name : plan.nameEn}
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-white/50"> {plan.currency}{t('perMonth')}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className={isPremium ? 'text-red-400' : 'text-green-400'} size={15} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded?.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/30">
                      <X size={15} /> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isLoading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${
                    isPremium ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                  } disabled:opacity-50`}>
                  {isLoading
                    ? <><Loader2 className="animate-spin" size={16} /> {lang === 'ar' ? 'جاري التوجيه...' : 'Redirecting...'}</>
                    : <><CreditCard size={16} /> {lang === 'ar' ? `اشترك - ${plan.price} ${plan.currency}` : `Subscribe - ${plan.price} ${plan.currency}`}</>
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <CreditCard size={16} />
            {lang === 'ar' ? 'يدعم: Mada · Visa · Mastercard · Apple Pay · STC Pay' : 'Supports: Mada · Visa · Mastercard · Apple Pay · STC Pay'}
          </div>
          <div className="flex items-center gap-2 text-green-400/70 text-xs">
            <CheckCircle size={14} />
            {lang === 'ar' ? 'دفع آمن عبر MyFatoorah المعتمدة من SAMA' : 'Secure payment via MyFatoorah certified by SAMA'}
          </div>
        </div>
      </main>
    </div>
  );
}
