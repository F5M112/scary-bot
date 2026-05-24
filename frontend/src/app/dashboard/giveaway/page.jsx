'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { giveawayAPI, guildsAPI, ticketsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import {
  Gift, Plus, Trash2, Loader2, X,
  Trophy, RotateCcw, StopCircle, Clock, Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GiveawayPage() {
  const { user } = useAuthStore();
  const t    = useT();
  const lang = useI18n((s) => s.lang);
  const [guilds, setGuilds]               = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [giveaways, setGiveaways]         = useState([]);
  const [channels, setChannels]           = useState([]);
  const [loading, setLoading]             = useState(false);
  const [showCreate, setShowCreate]       = useState(false);

  useEffect(() => { guildsAPI.list().then(({ data }) => setGuilds(data.guilds)); }, []);
  useEffect(() => { if (selectedGuild) loadAll(); }, [selectedGuild]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([
        giveawayAPI.list(selectedGuild),
        ticketsAPI.channels(selectedGuild).catch(() => ({ data: { channels: [] } })),
      ]);
      setGiveaways(g.data.giveaways);
      setChannels(c.data.channels?.filter((x) => x.type === 'text') || []);
    } catch { toast.error(t('error')); }
    finally { setLoading(false); }
  };

  const handleEnd = async (id) => {
    if (!confirm(lang === 'ar' ? 'سيتم إنهاء المسابقة الآن. تأكيد؟' : 'End giveaway now? Confirm?')) return;
    try { await giveawayAPI.end(selectedGuild, id); toast.success('✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || t('error')); }
  };

  const handleReroll = async (id) => {
    if (!confirm(lang === 'ar' ? 'إعادة السحب. تأكيد؟' : 'Reroll winners? Confirm?')) return;
    try { await giveawayAPI.reroll(selectedGuild, id); toast.success('✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || t('error')); }
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === 'ar' ? 'حذف المسابقة نهائياً؟' : 'Delete giveaway permanently?')) return;
    try { await giveawayAPI.delete(selectedGuild, id); toast.success('✅'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.error || t('error')); }
  };

  const active = giveaways.filter((g) => g.status === 'active');
  const ended  = giveaways.filter((g) => g.status === 'ended');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Gift className="text-yellow-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">🎉 {t('giveaways')}</h1>
          <p className="text-white/60">{t('giveawayDesc')}</p>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-2">{t('selectServer')}</label>
        <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} className="input">
          <option value="">— {t('selectServer')} —</option>
          {guilds.map((g) => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
        </select>
      </div>

      {selectedGuild && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm text-white/60">
            <span className="text-green-400 font-bold">{active.length}</span> {lang === 'ar' ? 'نشطة' : 'active'} •
            <span className="text-white/50 mx-1">{ended.length}</span> {lang === 'ar' ? 'منتهية' : 'ended'}
          </div>
          {user?.plan !== 'premium' && giveaways.length >= 1 ? (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
              <Crown size={14} />
              <span>{lang === 'ar' ? 'استخدمت تجربتك المجانية' : 'Free trial used'}</span>
              <Link href="/dashboard/subscription" className="text-xs bg-amber-500 text-black px-2 py-1 rounded font-bold">{t('upgradeNow')}</Link>
            </div>
          ) : (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> {t('createGiveaway')}
            </button>
          )}
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-500" size={32} /></div>}

      {selectedGuild && !loading && active.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Clock className="text-green-400" size={18} /> {t('giveawayActive')}
          </h2>
          <div className="grid gap-4">
            {active.map((g) => <GiveawayCard key={g._id} g={g} channels={channels} lang={lang} t={t} onEnd={handleEnd} onDelete={handleDelete} />)}
          </div>
        </section>
      )}

      {selectedGuild && !loading && ended.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Trophy className="text-yellow-400" size={18} /> {t('giveawayEnded')}
          </h2>
          <div className="grid gap-4">
            {ended.map((g) => <GiveawayCard key={g._id} g={g} channels={channels} lang={lang} t={t} onReroll={handleReroll} onDelete={handleDelete} />)}
          </div>
        </section>
      )}

      {selectedGuild && !loading && giveaways.length === 0 && (
        <div className="card text-center py-16">
          <Gift className="mx-auto text-white/20 mb-4" size={56} />
          <p className="text-white/60 text-lg font-medium">{t('giveawayEmpty')}</p>
          <p className="text-white/40 text-sm mt-2 mb-6">{t('giveawayEmptyDesc')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> {t('createGiveaway')}
          </button>
        </div>
      )}

      {showCreate && (
        <CreateGiveawayModal
          guildId={selectedGuild}
          channels={channels}
          lang={lang}
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadAll(); }}
        />
      )}
    </div>
  );
}

function GiveawayCard({ g, channels, lang, t, onEnd, onReroll, onDelete }) {
  const isActive    = g.status === 'active';
  const timeLeft    = Math.max(0, new Date(g.endAt) - Date.now());
  const channelName = channels.find((c) => c.id === g.channelId)?.name || g.channelId;

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (lang === 'ar') {
      if (d > 0) return `${d} يوم`;
      if (h > 0) return `${h} ساعة`;
      if (m > 0) return `${m} دقيقة`;
      return `${s} ثانية`;
    } else {
      if (d > 0) return `${d}d`;
      if (h > 0) return `${h}h`;
      if (m > 0) return `${m}m`;
      return `${s}s`;
    }
  };

  return (
    <div className={`card border-2 ${isActive ? 'border-green-500/30' : 'border-white/10'}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-2xl shrink-0">🎉</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg">{g.title}</h3>
            {isActive
              ? <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full animate-pulse">🟢 {lang === 'ar' ? 'نشطة' : 'Active'}</span>
              : <span className="text-xs bg-white/5 text-white/50 border border-white/10 px-2 py-0.5 rounded-full">⚫ {lang === 'ar' ? 'منتهية' : 'Ended'}</span>
            }
          </div>
          <div className="mt-1 text-yellow-400 font-bold">🏆 {g.prize}</div>
          {g.description && <p className="text-sm text-white/60 mt-1">{g.description}</p>}
        </div>
      </div>

      {g.rules && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg text-sm text-white/70">
          <div className="font-medium text-white/90 mb-1">📋 {lang === 'ar' ? 'القوانين:' : 'Rules:'}</div>
          <div className="whitespace-pre-wrap">{g.rules}</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label={t('giveawayParticipants')} value={g.participants.length} icon="👤" />
        <Stat label={t('giveawayWinners')}       value={g.winnersCount}        icon="🏆" />
        <Stat label={lang === 'ar' ? 'القناة' : 'Channel'} value={`#${channelName}`} icon="📢" />
        <Stat
          label={isActive ? (lang === 'ar' ? 'الوقت المتبقي' : 'Time Left') : (lang === 'ar' ? 'انتهت' : 'Ended')}
          value={isActive ? formatTime(timeLeft) : new Date(g.endAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
          icon={isActive ? '⏰' : '🔴'}
        />
      </div>

      {!isActive && g.winners.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="font-bold text-yellow-300 mb-2 flex items-center gap-2">
            <Trophy size={16} /> {t('giveawayWinnersLabel')}
          </div>
          <div className="flex flex-wrap gap-2">
            {g.winners.map((w, i) => (
              <span key={i} className="text-xs bg-yellow-500/20 text-yellow-200 px-3 py-1 rounded-full font-mono" dir="ltr">
                @user:{w.slice(-6)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isActive && (
          <button onClick={() => onEnd(g._id)} className="btn-danger flex items-center gap-2 text-sm">
            <StopCircle size={14} /> {t('giveawayEnd')}
          </button>
        )}
        {!isActive && (
          <button onClick={() => onReroll(g._id)} className="btn-secondary flex items-center gap-2 text-sm">
            <RotateCcw size={14} /> {t('giveawayReroll')}
          </button>
        )}
        <button onClick={() => onDelete(g._id)} className="text-sm px-3 py-2 bg-red-900/20 text-red-400 hover:bg-red-900/40 rounded-lg flex items-center gap-2 border border-red-900/30">
          <Trash2 size={14} /> {t('delete')}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5 text-center">
      <div className="text-lg">{icon}</div>
      <div className="font-bold text-sm truncate">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

function CreateGiveawayModal({ guildId, channels, lang, t, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', prize: '', rules: '', winnersCount: 1, endAt: '', channelId: '', embedColor: '#FFD700' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm((f) => ({ ...f, endAt: local }));
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title || !form.prize || !form.channelId || !form.endAt)
      return toast.error(lang === 'ar' ? 'العنوان، الجائزة، القناة، والتاريخ مطلوبة' : 'Title, prize, channel and date are required');
    if (new Date(form.endAt) <= new Date())
      return toast.error(lang === 'ar' ? 'التاريخ يجب أن يكون في المستقبل' : 'Date must be in the future');
    setSubmitting(true);
    try {
      await giveawayAPI.create(guildId, form);
      toast.success('✅ ' + t('success'));
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl my-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="text-yellow-400" size={24} />
            {t('createGiveaway')}
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={22} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5">{t('giveawayTitle')} <span className="text-red-400">*</span></label>
              <input value={form.title} onChange={(e) => update('title', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('giveawayPrize')} <span className="text-red-400">*</span></label>
              <input value={form.prize} onChange={(e) => update('prize', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('giveawayWinners')}</label>
              <input type="number" value={form.winnersCount} onChange={(e) => update('winnersCount', Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))} min={1} max={50} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('giveawayChannel')} <span className="text-red-400">*</span></label>
              <select value={form.channelId} onChange={(e) => update('channelId', e.target.value)} className="input">
                <option value="">— {t('selectChannel')} —</option>
                {channels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('giveawayEndAt')} <span className="text-red-400">*</span></label>
              <input type="datetime-local" value={form.endAt} onChange={(e) => update('endAt', e.target.value)} className="input" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{t('giveawayDescription')} ({t('optional')})</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('giveawayRules')} ({t('optional')})</label>
            <textarea value={form.rules} onChange={(e) => update('rules', e.target.value)} rows={3} className="input resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">{lang === 'ar' ? 'لون الرسالة' : 'Message Color'}</label>
            <div className="flex gap-3 items-center flex-wrap">
              {['#FFD700', '#FF6B6B', '#5865F2', '#23A55A', '#FF69B4', '#00BFFF'].map((color) => (
                <button key={color} onClick={() => update('embedColor', color)}
                  className={`w-10 h-10 rounded-full border-4 transition ${form.embedColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }} />
              ))}
              <input type="color" value={form.embedColor} onChange={(e) => update('embedColor', e.target.value)} className="w-10 h-10 rounded-full cursor-pointer bg-transparent border border-white/20" />
            </div>
          </div>

          <div className="p-4 bg-[#2B2D31] rounded-xl border border-white/10 text-white" dir="ltr">
            <p className="text-xs text-white/50 mb-3 text-right">📱 {t('giveawayPreview')}</p>
            <div className="border-r-4 rounded pl-3 py-2" style={{ borderColor: form.embedColor }}>
              <div className="font-bold text-base mb-1">🎉 {form.title || (lang === 'ar' ? 'عنوان المسابقة' : 'Giveaway Title')}</div>
              {form.description && <div className="text-sm text-white/70 mb-2">{form.description}</div>}
              <div className="text-sm">🏆 <b>{lang === 'ar' ? 'الجائزة' : 'Prize'}:</b> {form.prize || '...'}</div>
              <div className="text-sm">👥 <b>{lang === 'ar' ? 'عدد الفائزين' : 'Winners'}:</b> {form.winnersCount}</div>
              <div className="text-sm">👤 <b>{lang === 'ar' ? 'المشتركون' : 'Participants'}:</b> 0</div>
            </div>
            <button className="mt-3 bg-[#23A55A] text-white text-sm px-4 py-1.5 rounded font-medium">
              🎉 {lang === 'ar' ? 'اشترك في المسابقة' : 'Join Giveaway'}
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={submit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Gift size={16} />}
              {submitting ? (lang === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : t('createGiveaway')}
            </button>
            <button onClick={onClose} className="btn-secondary py-3 px-5">{t('cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
