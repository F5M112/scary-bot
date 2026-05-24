'use client';
import { useEffect, useState } from 'react';
import { botAPI, guildsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Bot, Crown, Eye, EyeOff, Loader2, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function BotSettingsPage() {
  const { user } = useAuthStore();
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    guildsAPI.list().then(({ data }) => setGuilds(data.guilds));
  }, []);

  useEffect(() => {
    if (selectedGuild) {
      botAPI.status(selectedGuild).then(({ data }) => setStatus(data));
    } else {
      setStatus(null);
    }
  }, [selectedGuild]);

  const isPremium = user?.plan === 'premium';

  const handleSave = async () => {
    if (!selectedGuild || !token) return toast.error('املأ كل الحقول');
    setLoading(true);
    try {
      await botAPI.setToken({ guildId: selectedGuild, token });
      toast.success('✅ تم ربط البوت بنجاح');
      setToken('');
      const { data } = await botAPI.status(selectedGuild);
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل ربط البوت');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('سيتم إزالة البوت المخصص واستخدام البوت الرئيسي. متابعة؟')) return;
    setLoading(true);
    try {
      await botAPI.removeToken(selectedGuild);
      toast.success('تم إزالة البوت المخصص');
      const { data } = await botAPI.status(selectedGuild);
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Bot className="text-brand-500" size={32} />
        <div>
          <h1 className="text-3xl font-bold">إعدادات البوت</h1>
          <p className="text-white/60">إدارة بوت ديسكورد لسيرفراتك</p>
        </div>
      </div>

      {/* Server selector */}
      <div className="card">
        <label className="block text-sm font-medium mb-2">السيرفر</label>
        <select
          value={selectedGuild}
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="input"
        >
          <option value="">— {t('selectServer')} —</option>
          {guilds.map(g => (
            <option key={g.guildId} value={g.guildId}>{g.guildName}</option>
          ))}
        </select>
      </div>

      {/* Status card */}
      {status && (
        <div className="card">
          <h3 className="font-bold mb-4">حالة البوت</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <StatusRow
              label="الحالة"
              value={status.online ? 'متصل' : 'غير متصل'}
              good={status.online}
            />
            <StatusRow
              label="الوضع"
              value={status.mode === 'custom' ? 'بوت مخصص' : 'البوت الرئيسي'}
              good={status.mode === 'custom'}
            />
            <StatusRow
              label="مفعل"
              value={status.enabled ? 'نعم' : 'لا'}
              good={status.enabled}
            />
            {status.botUser && (
              <StatusRow label="اسم البوت" value={status.botUser.tag} good={true} />
            )}
          </div>
        </div>
      )}

      {/* Custom Bot Token form */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Crown className="text-brand-400" size={18} />
            البوت المخصص
          </h3>
          <span className="badge-premium">بريميوم فقط</span>
        </div>

        {!isPremium ? (
          <div className="text-center py-8">
            <p className="text-white/60 mb-4">
              ميزة البوت المخصص متاحة لمشتركي الباقة المميزة فقط.
            </p>
            <Link href="/dashboard/subscription" className="btn-primary inline-flex items-center gap-2">
              <Crown size={16} /> الترقية الآن
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 flex gap-3 text-sm">
              <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div className="text-amber-100/90">
                <div className="font-bold mb-1">احتياطات أمنية:</div>
                <ul className="space-y-1 text-amber-100/70">
                  <li>• لا تشارك توكن البوت مع أي شخص.</li>
                  <li>• يتم تشفير التوكن قبل تخزينه.</li>
                  <li>• يجب أن يكون البوت موجوداً في السيرفر بصلاحيات كاملة.</li>
                  <li>• فعّل الـ Privileged Intents من Discord Developer Portal.</li>
                </ul>
              </div>
            </div>

            <label className="block text-sm font-medium mb-2">توكن البوت</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="MTxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="input pl-10 font-mono text-xs"
                dir="ltr"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                type="button"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={loading || !selectedGuild || !token}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                حفظ وربط البوت
              </button>
              {status?.mode === 'custom' && (
                <button
                  onClick={handleRemove}
                  disabled={loading}
                  className="btn-danger flex items-center gap-2"
                >
                  <Trash2 size={16} /> إزالة
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value, good }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
      <span className="text-sm text-white/60">{label}</span>
      <span className={`text-sm font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>
        {value}
      </span>
    </div>
  );
}
