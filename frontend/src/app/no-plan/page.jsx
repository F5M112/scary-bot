'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { subscriptionAPI } from '@/lib/api';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import { Crown, Check, Loader2, X, CreditCard, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionPage() {
  const { user, fetchUser } = useAuthStore();
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const searchParams = useSearchParams();
  const [plans, setPlans]       = useState([]);
  const [me, setMe]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    Promise.all([subscriptionAPI.plans(), subscriptionAPI.me()])
      .then(([p, m]) => { setPlans(p.data.plans); setMe(m.data); setLoading(false); });
  }, []);

  // Handle PayPal return
  useEffect(() => {
    const payment  = searchParams.get('payment');
    const planId   = searchParams.get('plan');
    const orderId  = searchParams.get('token'); // PayPal sends token=orderId

    if (payment === 'success' && planId && orderId) {
      setVerifying(true);
      api.post('/subscription/verify', { orderId, planId })
        .then(({ data }) => {
          toast.success(data.message || '✅ تم تفعيل الباقة!');
          fetchUser();
          subscriptionAPI.me().then(({ data: m }) => setMe(m));
        })
        .catch(() => toast.error('حدث خطأ في التحقق. تواصل مع الدعم.'))
        .finally(() => setVerifying(false));
      window.history.replaceState({}, '', '/dashboard/subscription');
    } else if (payment === 'cancelled') {
      toast.error('تم إلغاء الدفع.');
      window.history.replaceState({}, '', '/dashboard/subscription');
    }
  }, []);

  const handleCheckout = async (planId) => {
    if (planId === me?.plan) return;
    setPaying(planId);
    try {
      const { data } = await api.post('/subscription/checkout', { planId });
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل إنشاء رابط الدفع');
      setPaying('');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;

  return (
    <div className="space-y-8 max-w-5xl">
      {verifying && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="card text-center p-8">
            <Loader2 className="animate-spin text-green-400 mx-auto mb-4" size={40} />
            <div className="font-bold text-lg">{lang === 'ar' ? 'جاري تفعيل الباقة...' : 'Activating your plan...'}</div>
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
          </div>
          <div>
            <div className="text-sm text-white/60">{lang === 'ar' ? 'السيرفرات المسجلة' : 'Registered Servers'}</div>
            <div className="text-2xl font-bold">{me?.guildCount || 0}</div>
          </div>
        </div>
      </div>

      {/* PayPal badge */}
      <div className="flex items-center gap-3 p-3 bg-[#003087]/20 rounded-xl border border-[#003087]/30">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#009cde"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
        <span className="text-sm text-white/70">
          {lang === 'ar' ? 'الدفع عبر PayPal — Visa · Mastercard · PayPal Balance' : 'Pay via PayPal — Visa · Mastercard · PayPal Balance'}
        </span>
      </div>

      {/* Plans */}
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

              <div className="mb-4">
                <span className="text-4xl font-black">${plan.price}</span>
                <span className="text-white/50">{t('perMonth')}</span>
              </div>

              <ul className="space-y-3 mb-6">
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

              <button onClick={() => handleCheckout(plan.id)} disabled={isCurrent || isLoading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${
                  isCurrent ? 'bg-white/5 text-white/50 cursor-not-allowed'
                  : isPremiumPlan ? 'btn-primary' : 'btn-secondary'
                } disabled:opacity-50`}>
                {isLoading
                  ? <><Loader2 className="animate-spin" size={16} /> {lang === 'ar' ? 'جاري التوجيه...' : 'Redirecting...'}</>
                  : isCurrent
                    ? `✓ ${lang === 'ar' ? 'باقتك الحالية' : 'Your Plan'}`
                    : <><CreditCard size={16} /> {lang === 'ar' ? `اشترك - $${plan.price}` : `Subscribe - $${plan.price}`}</>
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
            {lang === 'ar' ? 'جميع المدفوعات تتم عبر PayPal المشفرة والآمنة.' : 'All payments are processed through encrypted and secure PayPal.'}
          </div>
        </div>
      </div>
    </div>
  );
}
