'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Eye, EyeOff, Loader2, User, Lock } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { login } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('املأ كل الحقول');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success('✅ مرحباً بعودتك!');
      if (user.role === 'admin')   router.push('/admin');
      else if (!user.hasPlan)      router.push('/no-plan');
      else                         router.push('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="absolute top-4 ltr:right-4 rtl:left-4">
        <LanguageSwitcher />
      </div>

      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card w-full max-w-md glow-red">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo size={72} />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('login')}</h1>
            <p className="text-white/60 text-sm">أدخل بيانات حسابك للمتابعة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">اسم المستخدم</label>
              <div className="relative">
                <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="input ltr:pl-10 rtl:pr-10"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input ltr:pl-10 rtl:pr-10 ltr:pr-10 rtl:pl-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              {t('login')}
            </button>
          </form>

          <p className="text-xs text-white/40 text-center mt-6">
            ليس لديك حساب؟ تواصل مع الإدارة لإنشاء حساب لسيرفرك.
          </p>
        </div>
      </div>
    </div>
  );
}
