'use client';
import { useEffect, useState } from 'react';
import { subscriptionAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import { Crown, Check, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const [plans, setPlans] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleUpgrade = async (planId) => {
    if (planId === user.plan) return;
    try {
      const { data } = await subscriptionAPI.upgrade(planId);
      toast.success(data.message);
    } catch {
      toast.error(lang === 'ar' ? 'الرجاء التواصل مع الإدارة للترقية' : 'Please contact admin to upgrade');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
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
              <span className="text-2xl font-bold capitalize">
                {me?.plan === 'premium' ? t('premium') : t('classic')}
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
          <div className="text-left">
            <div className="text-sm text-white/60">{lang === 'ar' ? 'السيرفرات المسجلة' : 'Registered Servers'}</div>
            <div className="text-2xl font-bold">{me?.guildCount}</div>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map(plan => {
          const isCurrent    = me?.plan === plan.id;
          const isPremiumPlan = plan.id === 'premium';
          return (
            <div key={plan.id}
              className={`card relative ${isPremiumPlan ? 'border-brand-500/40 bg-gradient-to-br from-[#15151f] to-brand-950/20' : ''} ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 right-6 badge-premium flex items-center gap-1">
                  <Crown size={12} /> {t('mostPopular')}
                </div>
              )}
              <div className={`font-bold mb-2 ${isPremiumPlan ? 'text-brand-400' : 'text-blue-400'}`}>
                {plan.name}
              </div>
              <div className="mb-6">
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

              <button onClick={() => handleUpgrade(plan.id)} disabled={isCurrent}
                className={`w-full ${isCurrent ? 'bg-white/5 text-white/50 cursor-not-allowed py-2.5 rounded-lg font-medium' : isPremiumPlan ? 'btn-primary' : 'btn-secondary'}`}>
                {isCurrent
                  ? `✓ ${lang === 'ar' ? 'باقتك الحالية' : 'Your Current Plan'}`
                  : isPremiumPlan
                    ? t('upgradeNow')
                    : t('subscribe')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
