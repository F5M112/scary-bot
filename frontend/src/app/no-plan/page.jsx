'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import { LogOut, Crown, Check, X, CheckCircle } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const PAYPAL_CLIENT_ID = 'AYEgUH1z595VlHZn41TPuojG4wa-YCcbU_f-xS_o7Btxdd5UQ_G5hlZuwuUgTx0LHGqh1zHuMsng7EGa';

const PLANS = [
  {
    id:       'classic',
    planId:   'P-1LE45713A72191358NINVKDY',
    name:     'كلاسيك',
    nameEn:   'Classic',
    price:    '9.99',
    popular:  false,
    features: [
      'نظام تذاكر متكامل',
      'مسابقة واحدة نشطة',
      'الأذكار التلقائية',
      'نظام الترحيب',
      'الإذاعة الشاملة',
      'البوت الرئيسي',
    ],
    notIncluded: [
      'مسابقات متعددة',
      'الإذاعة المستهدفة',
      'البوت المخصص',
    ],
  },
  {
    id:       'premium',
    planId:   'P-3UA87746UN2669008NINVNIA',
    name:     'بريميوم',
    nameEn:   'Premium',
    price:    '24.99',
    popular:  true,
    features: [
      'كل مميزات الكلاسيك',
      'مسابقات لا محدودة',
      'الإذاعة المستهدفة بمعرفات',
      'بوت مخصص (توكن خاص)',
      'سجلات تفصيلية',
    ],
  },
];

function PayPalButton({ plan, onSuccess }) {
  const containerRef = useRef(null);
  const rendered     = useRef(false);

  useEffect(() => {
    if (rendered.current || !window.paypal || !containerRef.current) return;
    rendered.current = true;

    window.paypal.Buttons({
      style: {
        shape:  'rect',
        color:  plan.id === 'premium' ? 'gold' : 'silver',
        layout: 'vertical',
        label:  'subscribe',
      },
      createSubscription: (data, actions) =>
        actions.subscription.create({ plan_id: plan.planId }),
      onApprove: (data) => onSuccess(data.subscriptionID, plan.id),
      onError: (err) => console.error('[PayPal]', err),
    }).render(containerRef.current);
  }, []);

  return <div ref={containerRef} />;
}

export default function NoPlanPage() {
  const { user, loading, fetchUser, logout } = useAuthStore();
  const router   = useRouter();
  const t        = useT();
  const lang     = useI18n((s) => s.lang);
  const [sdkReady, setSdkReady]     = useState(false);
  const [success, setSuccess]       = useState('');

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

  // Load PayPal SDK once
  useEffect(() => {
    if (document.getElementById('paypal-sdk')) { setSdkReady(true); return; }
    const script = document.createElement('script');
    script.id  = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
    script.setAttribute('data-sdk-integration-source', 'button-factory');
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, []);

  const handleSuccess = (subscriptionId, planId) => {
    setSuccess(planId);
    // Notify backend to activate plan
    fetch('/api/paypal-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId, planId, userId: user._id }),
    }).catch(() => {});
    // Redirect after 2 seconds
    setTimeout(() => {
      fetchUser();
      router.replace('/dashboard');
    }, 2000);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a12]">
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
        {success && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
            <div className="card text-center p-10">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-2xl font-bold text-green-400 mb-2">
                {lang === 'ar' ? 'تم الاشتراك بنجاح!' : 'Subscription Successful!'}
              </div>
              <div className="text-white/60">
                {lang === 'ar' ? 'جاري تفعيل باقتك...' : 'Activating your plan...'}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-10 mt-6">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-3xl font-bold mb-2">
            {lang === 'ar'
              ? `مرحباً، ${user.displayName || user.username}!`
              : `Welcome, ${user.displayName || user.username}!`}
          </h1>
          <p className="text-white/60 text-lg">
            {lang === 'ar'
              ? 'اختر باقتك للبدء في استخدام ST Bot'
              : 'Choose your plan to start using ST Bot'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {PLANS.map(plan => {
            const isPremium = plan.id === 'premium';
            return (
              <div key={plan.id}
                className={`card relative ${isPremium
                  ? 'border-yellow-500/40 bg-gradient-to-br from-[#15151f] to-yellow-950/10'
                  : 'border-white/10'}`}>

                {plan.popular && (
                  <div className="absolute -top-3 right-6 bg-yellow-500 text-black text-xs px-3 py-1 rounded-full flex items-center gap-1 font-bold">
                    <Crown size={10} /> {t('mostPopular')}
                  </div>
                )}

                <div className={`text-xl font-bold mb-1 ${isPremium ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {lang === 'ar' ? plan.name : plan.nameEn}
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-white/50">{t('perMonth')}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className={isPremium ? 'text-yellow-400' : 'text-green-400'} size={15} />
                      {f}
                    </li>
                  ))}
                  {plan.notIncluded?.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/30">
                      <X size={15} /> {f}
                    </li>
                  ))}
                </ul>

                {/* PayPal Button */}
                <div className="mt-2">
                  {sdkReady
                    ? <PayPalButton plan={plan} onSuccess={handleSuccess} />
                    : <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
                  }
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 text-green-400/70 text-xs">
            <CheckCircle size={14} />
            {lang === 'ar'
              ? 'دفع آمن عبر PayPal — Visa · Mastercard · PayPal Balance'
              : 'Secure payment via PayPal — Visa · Mastercard · PayPal Balance'}
          </div>
          <div className="text-white/30 text-xs">
            {lang === 'ar' ? 'يمكنك إلغاء الاشتراك في أي وقت' : 'Cancel anytime'}
          </div>
        </div>
      </main>
    </div>
  );
}
