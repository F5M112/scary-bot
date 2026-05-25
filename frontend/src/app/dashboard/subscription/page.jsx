'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { subscriptionAPI } from '@/lib/api';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import { Crown, Check, Loader2, X, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionPage() {
  const { user, fetchUser } = useAuthStore();
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const searchParams = useSearchParams();
  const [plans, setPlans]     = useState([]);
  const [me, setMe]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying]   = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    Promise.all([
      subscriptionAPI.plans(),
      subscriptionAPI.me(),
    ]).then(([p, m]) => {
      setPlans(p.data.plans);
      setMe(m.data);
      setLoading(false);
    });
  }, []);

  // Handle payment callback
  useEffect(() => {
    const payment = searchParams.get('payment');
    const plan    = searchParams.get('plan');
    const paymentId = searchParams.get('paymentId');

    if (payment === 'success' && plan) {
      setVerifying(true);
      // Verify payment with backend
      api.post('/subscription/verify', { paymentId: paymentId || 'latest', planId: plan })
        .then(({ data }) => {
          toast.success(data.message || '✅ تم تفعيل الباقة!');
          fetchUser();
          subscriptionAPI.me().then(({ data: m }) => setMe(m));
        })
        .catch(() => {
          toast.success('✅ تم الدفع! سيتم تفعيل باقتك خلال دقائق.');
        })
        .finally(() => setVerifying(false));

      // Clean URL
      window.history.replaceState({}, '', '/dashboard/subscription');
    } else if (payment === 'failed') {
      toast.error('❌ فشل الدفع. حاول مرة أخرى.');
      window.history.replaceState({}, '', '/dashboard/subscription');
    }
  }, []);

  const handleCheckout = async (planId) => {
    if (planId === me?.plan) return;
    setPaying(planId);
    try {
      const { data } = await api.post('/subscription/checkout', { planId });
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل إنشاء رابط الدفع');
      setPaying('');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Verifying overlay */}
      {verifying && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="card text-center p-8">
            <Loader2 className="animate-spin text-green-400 mx-auto mb-4" size={40} />
            <div className="font-bold text-lg">{lang === 'ar' ? 'جاري التحقق من الدفع...' : 'Verifying payment...'}</div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold mb-1">{t('subscription')}</h1>
        <p className="text-white/60">{lang === 'ar' ? 'إدارة باقتك واختيار ما يناسبك' : 'Manage your plan and choose what suits you'}</p>
      </div>

      {/* Current plan */}
      <div className="card bg-gradient-to-br from-[#15151f] to-brand-950/20 border-brand-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/60 mb-1">{t('currentPlan')}</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">
                {me?.plan === 'premium' ? t('premium') : me?.plan === 'classic' ? t('classic') : t('none')}
              </span>
              {me?.plan === 'premium' && <Crown className="text-brand-400" size={24} />}
            </div>
            {me?.expiresAt && (
              <div className="text-sm text-white/60 mt-1">
                {t('expiresAt')} {new Date(me.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                {me.daysRemaining !== null && ` (${me.daysRemaining} ${t('daysRemaining')})`}
              </div>
            )}
            {!me?.expiresAt && me?.plan && (
              <div className="text-xs text-green-400 mt-1">✅ {lang === 'ar' ? 'باقة نشطة' : 'Active plan'}</div>
            )}
          </div>
          <div>
            <div className="text-sm text-white/60">{lang === 'ar' ? 'السيرفرات المسجلة' : 'Registered Servers'}</div>
            <div className="text-2xl font-bold">{me?.guildCount || 0}</div>
          </div>
        </div>
      </div>

      {/* Payment methods badge */}
      <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
        <CreditCard size={20} className="text-white/60" />
        <span className="text-sm text-white/60">
          {lang === 'ar' ? 'الدفع عبر:' : 'Pay via:'}
        </span>
        <span className="text-sm font-medium">Mada · Visa · Mastercard · Apple Pay · STC Pay</span>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map(plan => {
          const isCurrent    = me?.plan === plan.id;
          const isPremiumPlan = plan.id === 'premium';
          const isLoading    = paying === plan.id;

          return (
            <div key={plan.id}
              className={`card relative ${isPremiumPlan ? 'border-brand-500/40 bg-gradient-to-br from-[#15151f] to-brand-950/20' : ''} ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>

              {plan.popular && (
                <div className="absolute -top-3 right-6 badge-premium flex items-center gap-1">
                  <Crown size={12} /> {t('mostPopular')}
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-6 flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  <CheckCircle size={12} /> {lang === 'ar' ? 'باقتك الحالية' : 'Current Plan'}
                </div>
              )}

              <div className={`font-bold mb-2 ${isPremiumPlan ? 'text-brand-400' : 'text-blue-400'}`}>
                {lang === 'ar' ? plan.name : plan.nameEn}
              </div>

              <div className="mb-2">
                <span className="text-4xl font-black">{plan.price}</span>
                <span className="text-white/50 text-lg"> {plan.currency}</span>
                <span className="text-white/50">{t('perMonth')}</span>
              </div>

              <ul className="space-y-3 mb-6 mt-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={isPremiumPlan ? 'text-brand-400' : 'text-green-400'} size={16} />
                    {f}
                  </li>
                ))}
                {plan.notIncluded?.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/40">
                    <X size={16} /> {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCurrent || isLoading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${
                  isCurrent
                    ? 'bg-white/5 text-white/50 cursor-not-allowed'
                    : isPremiumPlan
                      ? 'btn-primary'
                      : 'btn-secondary'
                }`}>
                {isLoading
                  ? <><Loader2 className="animate-spin" size={16} /> {lang === 'ar' ? 'جاري التوجيه...' : 'Redirecting...'}</>
                  : isCurrent
                    ? `✓ ${lang === 'ar' ? 'باقتك الحالية' : 'Your Current Plan'}`
                    : <><CreditCard size={16} /> {lang === 'ar' ? `اشترك بـ ${plan.price} ${plan.currency}` : `Subscribe ${plan.price} ${plan.currency}`}</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex gap-3">
        <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-green-200/90">
          <div className="font-bold mb-1">{lang === 'ar' ? 'دفع آمن 100%' : '100% Secure Payment'}</div>
          <div className="text-green-200/70">
            {lang === 'ar'
              ? 'جميع المدفوعات تتم عبر MyFatoorah المعتمدة من البنك المركزي السعودي (SAMA). بياناتك محمية بالكامل.'
              : 'All payments are processed through MyFatoorah, certified by SAMA. Your data is fully protected.'}
          </div>
        </div>
      </div>
    </div>
  );
}
