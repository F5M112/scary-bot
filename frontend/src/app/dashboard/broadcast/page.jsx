'use client';
import { useEffect, useState } from 'react';
import { broadcastAPI, guildsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import {
  Megaphone, Send, Users, UserPlus, Loader2,
  Crown, Plus, Trash2, History, CheckCircle2, XCircle, Lock,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function BroadcastPage() {
  const { user }                = useAuthStore();
  const t                       = useT();
  const [guilds, setGuilds]     = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [mode, setMode]         = useState('global');
  const [message, setMessage]   = useState('السلام عليكم يا {username}،\n\nيسعدنا إخباركم بـ...');
  const [recipients, setRecipients] = useState([{ id: '', name: '' }]);
  const [sending, setSending]   = useState(false);
  const [logs, setLogs]         = useState([]);

  const isPremium = user?.plan === 'premium';

  useEffect(() => {
    guildsAPI.list().then(({ data }) => setGuilds(data.guilds));
  }, [user]);

  useEffect(() => {
    if (selectedGuild) {
      broadcastAPI.logs(selectedGuild).then(({ data }) => setLogs(data.logs)).catch(() => {});
    }
  }, [selectedGuild]);

  const addRecipient    = () => setRecipients([...recipients, { id: '', name: '' }]);
  const removeRecipient = (i) => setRecipients(recipients.filter((_, idx) => idx !== i));
  const updateRecipient = (i, field, value) => {
    const next = [...recipients];
    next[i][field] = value;
    setRecipients(next);
  };

  const handleSend = async () => {
    if (!selectedGuild) return toast.error('اختر سيرفراً أولاً');
    if (!message.trim())  return toast.error('اكتب رسالة');
    if (mode === 'targeted' && !isPremium) return;

    let payload = { guildId: selectedGuild, message, mode };

    if (mode === 'targeted') {
      const valid = recipients.filter(r => r.id.trim() && /^\d{17,20}$/.test(r.id.trim()));
      if (valid.length === 0) return toast.error('أضف معرفات صحيحة على الأقل');
      payload.recipients = valid;
    }

    const confirmMsg = mode === 'global'
      ? `⚠️ سيتم إرسال الرسالة لكل أعضاء السيرفر. تأكيد؟`
      : `سيتم إرسال الرسالة لـ ${recipients.filter(r => r.id).length} مستخدم. تأكيد؟`;

    if (!confirm(confirmMsg)) return;

    setSending(true);
    try {
      const { data } = await broadcastAPI.send(payload);
      toast.success(`✅ بدأ الإرسال إلى ${data.totalRecipients} مستلم`);
      const { data: logData } = await broadcastAPI.logs(selectedGuild);
      setLogs(logData.logs);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل الإرسال');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Megaphone className="text-brand-500" size={32} />
        <div>
          <h1 className="text-3xl font-bold">{t('broadcastSystem')}</h1>
          <p className="text-white/60">{t('broadcastDesc')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Server */}
          <div className="card">
            <label className="block text-sm font-medium mb-2">السيرفر</label>
            <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} className="input">
              <option value="">— {t('selectServer')} —</option>
              {guilds.map(g => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
            </select>
          </div>

          {/* Mode toggle */}
          <div className="card">
            <label className="block text-sm font-medium mb-3">{t('sendType')}</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Global - available to all */}
              <button
                onClick={() => setMode('global')}
                className={`p-4 rounded-lg border-2 transition text-right ${
                  mode === 'global'
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <Users className={`mb-2 ${mode === 'global' ? 'text-brand-400' : 'text-white/60'}`} size={24} />
                <div className="font-bold mb-1">{t('globalBroadcast')}</div>
                <div className="text-xs text-white/60">{t('globalDesc')}</div>
              </button>

              {/* Targeted - premium only */}
              <button
                onClick={() => {
                  if (!isPremium) return;
                  setMode('targeted');
                }}
                className={`p-4 rounded-lg border-2 transition text-right relative overflow-hidden ${
                  !isPremium
                    ? 'border-white/10 opacity-70 cursor-not-allowed'
                    : mode === 'targeted'
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20'
                }`}
              >
                {!isPremium && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <div className="text-center">
                      <Crown className="text-yellow-400 mx-auto mb-1" size={20} />
                      <span className="text-xs text-yellow-300 font-bold">بريميوم فقط</span>
                    </div>
                  </div>
                )}
                <UserPlus className={`mb-2 ${mode === 'targeted' ? 'text-brand-400' : 'text-white/60'}`} size={24} />
                <div className="font-bold mb-1">{t('targetedBroadcast')}</div>
                <div className="text-xs text-white/60">{t('targetedDesc')}</div>
              </button>
            </div>

            {/* Premium upsell if not premium */}
            {!isPremium && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-3">
                <Lock className="text-yellow-400 shrink-0" size={16} />
                <div className="text-sm text-yellow-200/90 flex-1">
                  الإرسال المستهدف بمعرفات ديسكورد متاح للباقة المميزة فقط.
                </div>
                <Link href="/dashboard/subscription" className="text-xs bg-yellow-500 text-black px-3 py-1.5 rounded-lg font-bold whitespace-nowrap">
                  ترقية
                </Link>
              </div>
            )}
          </div>

          {/* Targeted recipients */}
          {mode === 'targeted' && isPremium && (
            <div className="card">
              <label className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{t('recipients')}</span>
                <span className="text-xs text-white/50">{recipients.length} / 500</span>
              </label>
              <div className="space-y-2 max-h-72 overflow-y-auto pl-2">
                {recipients.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="معرف ديسكورد (Discord ID)"
                      value={r.id}
                      onChange={(e) => updateRecipient(i, 'id', e.target.value)}
                      className="input flex-1"
                      dir="ltr"
                    />
                    <input
                      type="text"
                      placeholder="الاسم (اختياري)"
                      value={r.name}
                      onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                      className="input flex-1"
                    />
                    <button
                      onClick={() => removeRecipient(i)}
                      className="text-red-400 hover:text-red-300 p-2"
                      disabled={recipients.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addRecipient} className="mt-3 btn-secondary w-full flex items-center justify-center gap-2">
                <Plus size={16} /> {t('addRecipient')}
              </button>
            </div>
          )}

          {/* Message */}
          <div className="card">
            <label className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('message')}</span>
              <span className="text-xs text-white/50">{message.length} / 1500</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('writeMessage')}
              rows={6}
              maxLength={1500}
              className="input resize-none"
            />
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200/90">
              💡 {t('templateNote')}: <code className="bg-black/30 px-1.5 rounded text-blue-300">{'{username}'}</code>
            </div>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || !selectedGuild || (mode === 'targeted' && !isPremium)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3"
          >
            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            {sending ? t('sending') : t('sendBroadcast')}
          </button>
        </div>

        {/* Logs sidebar */}
        <div>
          <div className="card">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <History size={18} /> {t('broadcastHistory')}
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-white/50 text-center py-8">{t('noBroadcasts')}</p>
            ) : (
              <div className="space-y-3">
                {logs.map(log => (
                  <div key={log._id} className="border border-white/10 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5">
                        {log.mode === 'global' ? '🌐 شامل' : '🎯 مستهدف'}
                      </span>
                      <span className="text-xs text-white/40">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </span>
                    </div>
                    <div className="text-xs line-clamp-2 text-white/70 mb-2">{log.message}</div>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 size={10} /> {log.sentCount}
                      </span>
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle size={10} /> {log.failedCount}
                      </span>
                      <span className="text-white/40">من {log.totalRecipients}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
