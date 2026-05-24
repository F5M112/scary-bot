'use client';
import { useEffect, useState } from 'react';
import { botAPI, guildsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import { Bot, Crown, Eye, EyeOff, Loader2, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function BotSettingsPage() {
  const { user } = useAuthStore();
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => { guildsAPI.list().then(({ data }) => setGuilds(data.guilds)); }, []);

  useEffect(() => {
    if (selectedGuild) botAPI.status(selectedGuild).then(({ data }) => setStatus(data));
    else setStatus(null);
  }, [selectedGuild]);

  const isPremium = user?.plan === 'premium';

  const handleSave = async () => {
    if (!selectedGuild || !token) return toast.error(t('fillAllFields'));
    setLoading(true);
    try {
      await botAPI.setToken({ guildId: selectedGuild, token });
      toast.success('✅ ' + t('saveAndConnect'));
      setToken('');
      const { data } = await botAPI.status(selectedGuild);
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    } finally { setLoading(false); }
  };

  const handleRemove = async () => {
    if (!confirm(lang === 'ar' ? 'سيتم إزالة البوت المخصص. متابعة؟' : 'Custom bot will be removed. Continue?')) return;
    setLoading(true);
    try {
      await botAPI.removeToken(selectedGuild);
      toast.success(lang === 'ar' ? 'تم إزالة البوت المخصص' : 'Custom bot removed');
      const { data } = await botAPI.status(selectedGuild);
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Bot className="text-brand-500" size={32} />
        <div>
          <h1 className="text-3xl font-bold">{t('botSettings')}</h1>
          <p className="text-white/60">{lang === 'ar' ? 'إدارة بوت ديسكورد لسيرفراتك' : 'Manage your Discord bot for your servers'}</p>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-2">{t('selectServer')}</label>
        <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} className="input">
          <option value="">— {t('selectServer')} —</option>
          {guilds.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
        </select>
      </div>

      {status && (
        <div className="card">
          <h3 className="font-bold mb-4">{t('botStatus')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <StatusRow label={lang === 'ar' ? 'الحالة' : 'Status'} value={status.online ? t('online') : t('offline')} good={status.online} />
            <StatusRow label={lang === 'ar' ? 'الوضع' : 'Mode'} value={status.mode === 'custom' ? t('customBot2') : t('platformBot')} good={status.mode === 'custom'} />
            <StatusRow label={lang === 'ar' ? 'مفعل' : 'Enabled'} value={status.enabled ? t('yes') : t('no')} good={status.enabled} />
            {status.botUser && <StatusRow label={lang === 'ar' ? 'اسم البوت' : 'Bot Name'} value={status.botUser.tag} good={true} />}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Crown className="text-brand-400" size={18} />
            {t('customBotToken')}
          </h3>
          <span className="badge-premium">{t('premiumOnly')}</span>
        </div>

        {!isPremium ? (
          <div className="text-center py-8">
            <p className="text-white/60 mb-4">{t('customBotPremiumOnly')}</p>
            <Link href="/dashboard/subscription" className="btn-primary inline-flex items-center gap-2">
              <Crown size={16} /> {t('upgradeNow')}
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 flex gap-3 text-sm">
              <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div className="text-amber-100/90">
                <div className="font-bold mb-1">{t('securityWarning')}</div>
                <ul className="space-y-1 text-amber-100/70">
                  <li>• {t('securityTip1')}</li>
                  <li>• {t('securityTip2')}</li>
                  <li>• {t('securityTip3')}</li>
                  <li>• {t('securityTip4')}</li>
                </ul>
              </div>
            </div>

            <label className="block text-sm font-medium mb-2">{t('botToken')}</label>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="MTxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="input pl-10 font-mono text-xs" dir="ltr" />
              <button onClick={() => setShowToken(!showToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white" type="button">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={handleSave} disabled={loading || !selectedGuild || !token}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {t('saveAndConnect')}
              </button>
              {status?.mode === 'custom' && (
                <button onClick={handleRemove} disabled={loading} className="btn-danger flex items-center gap-2">
                  <Trash2 size={16} /> {t('disconnect')}
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
      <span className={`text-sm font-medium ${good ? 'text-green-400' : 'text-red-400'}`}>{value}</span>
    </div>
  );
}
