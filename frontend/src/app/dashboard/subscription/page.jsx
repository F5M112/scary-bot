'use client';
import { useEffect, useState } from 'react';
import { subscriptionAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Crown, Check, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubscriptionPage() {
  const { user, fetchUser } = useAuthStore();
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
      toast.error('الرجاء التواصل مع الإدارة للترقية');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold mb-1">الاشتراك</h1>
        <p className="text-white/60">إدارة باقتك واختيار ما يناسبك</p>
      </div>

      {/* Current plan */}
      <div className="card bg-gradient-to-br from-[#15151f] to-brand-950/20 border-brand-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/60 mb-1">باقتك الحالية</div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold capitalize">
                {me?.plan === 'premium' ? 'بريميوم' : 'كلاسيك'}
              </span>
              {me?.plan === 'premium' && <Crown className="text-brand-400" size={24} />}
            </div>
            {me?.expiresAt && (
              <div className="text-sm text-white/60 mt-1">
                تنتهي في {new Date(me.expiresAt).toLocaleDateString('ar-SA')}
                {me.daysRemaining !== null && ` (${me.daysRemaining} يوم متبقي)`}
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-sm text-white/60">السيرفرات المسجلة</div>
            <div className="text-2xl font-bold">{me?.guildCount}</div>
          </div>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {plans.map(plan => {
          const isCurrent = me?.plan === plan.id;
          const isPremiumPlan = plan.id === 'premium';
          return (
            <div
              key={plan.id}
              className={`card relative ${
                isPremiumPlan ? 'border-brand-500/40 bg-gradient-to-br from-[#15151f] to-brand-950/20' : ''
              } ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 right-6 badge-premium flex items-center gap-1">
                  <Crown size={12} /> الأكثر شعبية
                </div>
              )}
              <div className={`font-bold mb-2 ${isPremiumPlan ? 'text-brand-400' : 'text-blue-400'}`}>
                {plan.name}
              </div>
              <div className="mb-6">
                <span className="text-4xl font-black">${plan.price}</span>
                <span className="text-white/50">/ شهرياً</span>
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
                    <X size={16} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent}
                className={`w-full ${
                  isCurrent
                    ? 'bg-white/5 text-white/50 cursor-not-allowed py-2.5 rounded-lg font-medium'
                    : isPremiumPlan
                      ? 'btn-primary bg-gradient-to-l from-brand-600 to-brand-600'
                      : 'btn-secondary'
                }`}
              >
                {isCurrent ? '✓ باقتك الحالية' : isPremiumPlan ? 'الترقية الآن' : 'الاشتراك'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
