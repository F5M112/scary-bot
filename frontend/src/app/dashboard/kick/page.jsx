'use client';
import { useEffect, useState } from 'react';
import { socialAPI, guildsAPI, ticketsAPI } from '@/lib/api';
import {
  Plus, Trash2, Loader2, X, Search, Edit3, Save,
  Volume2, VolumeX, Crown, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PLATFORM_UI = {
  kick:    { label: 'Kick',    emoji: '🟢', bg: 'bg-[#53FC18]/10', border: 'border-[#53FC18]/30', color: '#53FC18',  placeholder: 'مثال: D7miMax' },
  youtube: { label: 'YouTube', emoji: '🔴', bg: 'bg-red-500/10',   border: 'border-red-500/30',   color: '#FF0000',  placeholder: 'مثال: MrBeast' },
  twitch:  { label: 'Twitch',  emoji: '🟣', bg: 'bg-purple-500/10',border: 'border-purple-500/30',color: '#9146FF',  placeholder: 'مثال: shroud' },
  tiktok:  { label: 'TikTok',  emoji: '⚫', bg: 'bg-white/5',      border: 'border-white/20',     color: '#ffffff',  placeholder: 'مثال: khaby.lame' },
};

export default function SocialAlertsPage() {
  const [guilds, setGuilds]               = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [channels, setChannels]           = useState([]);
  const [discordChannels, setDiscordChannels] = useState([]);
  const [discordRoles, setDiscordRoles]   = useState([]);
  const [platformInfo, setPlatformInfo]   = useState([]);
  const [limits, setLimits]               = useState({});
  const [loading, setLoading]             = useState(false);
  const [showAdd, setShowAdd]             = useState(false);
  const [editing, setEditing]             = useState(null);
  const [addPlatform, setAddPlatform]     = useState(null);  // which platform to add

  useEffect(() => {
    guildsAPI.list().then(({ data }) => setGuilds(data.guilds));
    socialAPI.platforms().then(({ data }) => setPlatformInfo(data.platforms));
  }, []);

  useEffect(() => {
    if (selectedGuild) loadAll();
  }, [selectedGuild]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c, r] = await Promise.all([
        socialAPI.list(selectedGuild),
        ticketsAPI.channels(selectedGuild).catch(() => ({ data: { channels: [] } })),
        ticketsAPI.roles(selectedGuild).catch(() => ({ data: { roles: [] } })),
      ]);
      setChannels(s.data.channels || []);
      setLimits(s.data.limits || {});
      setDiscordChannels(c.data.channels?.filter((x) => x.type === 'text') || []);
      setDiscordRoles(r.data.roles || []);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  const handleToggle = async (ch) => {
    try {
      await socialAPI.update(selectedGuild, ch._id, { enabled: !ch.enabled });
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`حذف "${name}"؟`)) return;
    try {
      await socialAPI.remove(selectedGuild, id);
      toast.success('تم الحذف');
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  // Group channels by platform
  const grouped = channels.reduce((acc, ch) => {
    if (!acc[ch.platform]) acc[ch.platform] = [];
    acc[ch.platform].push(ch);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand-600/20 flex items-center justify-center text-2xl">📡</div>
        <div>
          <h1 className="text-3xl font-bold">Social Media Alerts</h1>
          <p className="text-white/60">تنبيهات البث المباشر من كل المنصات</p>
        </div>
      </div>

      {/* Server selector */}
      <div className="card">
        <label className="block text-sm font-medium mb-2">السيرفر</label>
        <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} className="input">
          <option value="">— اختر سيرفراً —</option>
          {guilds.map((g) => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
        </select>
      </div>

      {selectedGuild && (
        <>
          {/* Plan info */}
          {limits.maxChannels !== undefined && (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-white/60">
                {channels.length} / <span className="font-bold">{limits.maxChannels === 20 ? '∞' : limits.maxChannels}</span> قناة
                {limits.maxChannels === 1 && <span className="text-amber-400 mr-2">• الكلاسيك: قناة Kick واحدة فقط</span>}
              </div>
              {channels.length < (limits.maxChannels || 0) && (
                <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
                  <Plus size={16} /> إضافة قناة
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
          ) : channels.length === 0 ? (
            <div className="card text-center py-16">
              <div className="text-5xl mb-4">📡</div>
              <p className="text-white/60 text-lg font-medium mb-2">لا توجد قنوات مراقَبة</p>
              <p className="text-white/40 text-sm mb-6">أضف قناة للحصول على تنبيهات فورية عند بدء البث</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary inline-flex items-center gap-2">
                <Plus size={16} /> إضافة قناة
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([platform, chs]) => {
              const ui = PLATFORM_UI[platform] || PLATFORM_UI.kick;
              return (
                <section key={platform}>
                  <h2 className="flex items-center gap-2 text-lg font-bold mb-3">
                    <span>{ui.emoji}</span> {ui.label}
                    <span className="text-sm text-white/40 font-normal">({chs.length})</span>
                  </h2>
                  <div className="grid gap-3">
                    {chs.map((ch) => (
                      <div key={ch._id} className={`card border ${ui.border} flex items-center gap-4`}>
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ background: ui.color + '20', border: `2px solid ${ui.color}40` }}>
                          {ch.channelAvatar ? (
                            <img src={ch.channelAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">{ui.emoji}</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold flex items-center gap-2" dir="ltr">
                            @{ch.channelDisplayName || ch.channelUsername}
                            {ch.isLive && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">🔴 LIVE</span>}
                          </div>
                          <div className="text-xs text-white/50 mt-0.5">
                            📢 #{discordChannels.find((c) => c.id === ch.notifyChannelId)?.name || ch.notifyChannelId}
                            {ch.mentionEveryone && ' • @everyone'}
                            {ch.mentionRoleId && ` • @${discordRoles.find((r) => r.id === ch.mentionRoleId)?.name || 'role'}`}
                          </div>
                        </div>
                        <button onClick={() => handleToggle(ch)} className={`p-2 rounded ${ch.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-white/30 hover:bg-white/5'}`}>
                          {ch.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                        <button onClick={() => setEditing(ch)} className="btn-secondary p-2"><Edit3 size={14} /></button>
                        <button onClick={() => handleDelete(ch._id, ch.channelUsername)} className="btn-danger p-2"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </>
      )}

      {/* ADD MODAL: First choose platform */}
      {showAdd && !addPlatform && (
        <PlatformPicker
          platforms={platformInfo}
          onPick={(p) => setAddPlatform(p)}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showAdd && addPlatform && (
        <AddChannelModal
          guildId={selectedGuild}
          platform={addPlatform}
          discordChannels={discordChannels}
          discordRoles={discordRoles}
          onClose={() => { setShowAdd(false); setAddPlatform(null); }}
          onAdded={() => { setShowAdd(false); setAddPlatform(null); loadAll(); }}
        />
      )}

      {editing && (
        <EditChannelModal
          guildId={selectedGuild}
          channel={editing}
          discordChannels={discordChannels}
          discordRoles={discordRoles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadAll(); }}
        />
      )}
    </div>
  );
}

// ── Platform Picker ───────────────────────────────────────────────
function PlatformPicker({ platforms, onPick, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">اختر المنصة</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {platforms.map((p) => {
          const ui = PLATFORM_UI[p.id] || {};
          return (
            <button
              key={p.id}
              onClick={() => !p.locked && onPick(p.id)}
              disabled={p.locked}
              className={`p-5 rounded-xl border-2 transition text-center relative ${
                p.locked
                  ? 'border-white/10 opacity-50 cursor-not-allowed'
                  : `${ui.border} hover:bg-white/5`
              }`}
            >
              {p.locked && (
                <div className="absolute top-2 left-2">
                  <Crown size={12} className="text-yellow-400" />
                </div>
              )}
              <div className="text-4xl mb-2">{p.emoji}</div>
              <div className="font-bold">{p.label}</div>
              {p.locked && <div className="text-xs text-yellow-400 mt-1">مميز فقط</div>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Add Channel Modal ─────────────────────────────────────────────
function AddChannelModal({ guildId, platform, discordChannels, discordRoles, onClose, onAdded }) {
  const ui = PLATFORM_UI[platform] || PLATFORM_UI.kick;
  const [username, setUsername] = useState('');
  const [preview, setPreview]   = useState(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    notifyChannelId: '',
    mentionRoleId:   '',
    mentionEveryone: false,
    messageTemplate: `${ui.emoji} {streamer} الآن مباشر على ${ui.label}! {link}`,
    embedColor:      ui.color,
    embedTitle:      `${ui.emoji} [LIVE] {streamer}`,
  });

  const search = async () => {
    if (!username.trim()) return;
    setSearching(true); setPreview(null);
    try {
      const { data } = await socialAPI.lookup(platform, username.trim());
      setPreview(data.channel);
    } catch (err) {
      // Even on error, show basic preview so user can still add
      if (err.response?.status === 403) {
        toast.error(err.response.data.error);
      } else {
        // Show basic preview
        setPreview({
          username:    username.trim(),
          displayName: username.trim(),
          avatar:      null,
          isLive:      false,
          warning:     'سيتحقق البوت من القناة تلقائياً عند بدء المراقبة',
        });
      }
    } finally { setSearching(false); }
  };

  const submit = async () => {
    if (!preview || !form.notifyChannelId) return toast.error('حدد القناة وقناة التنبيه');
    setSubmitting(true);
    try {
      await socialAPI.add(guildId, { platform, channelUsername: preview.username, ...form });
      toast.success('✅ تم الإضافة');
      onAdded();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">{ui.emoji}</div>
        <div>
          <h3 className="text-xl font-bold">إضافة قناة {ui.label}</h3>
          <p className="text-sm text-white/50">أدخل اسم القناة للبحث</p>
        </div>
        <button onClick={onClose} className="mr-auto text-white/50"><X size={20} /></button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">اسم القناة</label>
          <div className="flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
              placeholder={ui.placeholder}
              className="input flex-1"
              dir="ltr"
            />
            <button onClick={search} disabled={searching} className="btn-secondary px-4">
              {searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            </button>
          </div>
        </div>

        {preview && (
          <div className={`p-3 rounded-lg border ${ui.border} ${ui.bg} flex items-center gap-3`}>
            {preview.avatar ? <img src={preview.avatar} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">{ui.emoji}</div>}
            <div className="flex-1" dir="ltr">
              <div className="font-bold">@{preview.displayName || preview.username}</div>
              <div className="text-xs text-white/60">
                {preview.isLive ? '🔴 مباشر الآن' : '⚫ غير متصل حالياً'}
              </div>
              {preview.warning && (
                <div className="text-xs text-amber-300 mt-1">⚠️ {preview.warning}</div>
              )}
            </div>
          </div>
        )}

        {preview && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1.5">قناة التنبيه في ديسكورد</label>
              <select value={form.notifyChannelId} onChange={(e) => setForm({ ...form, notifyChannelId: e.target.value })} className="input">
                <option value="">— اختر قناة —</option>
                {discordChannels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">منشن (اختياري)</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.mentionEveryone} onChange={(e) => setForm({ ...form, mentionEveryone: e.target.checked, mentionRoleId: '' })} />
                  @everyone
                </label>
                {!form.mentionEveryone && (
                  <select value={form.mentionRoleId} onChange={(e) => setForm({ ...form, mentionRoleId: e.target.value })} className="input">
                    <option value="">— بدون منشن —</option>
                    {discordRoles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">نص الرسالة</label>
              <textarea value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} rows={2} className="input resize-none" />
              <p className="text-xs text-white/40 mt-1">متغيرات: <code className="bg-black/20 px-1 rounded">{'{streamer}'}</code> <code className="bg-black/20 px-1 rounded">{'{title}'}</code> <code className="bg-black/20 px-1 rounded">{'{link}'}</code> <code className="bg-black/20 px-1 rounded">{'{viewers}'}</code></p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={submit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                إضافة
              </button>
              <button onClick={onClose} className="btn-secondary">إلغاء</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────
function EditChannelModal({ guildId, channel, discordChannels, discordRoles, onClose, onSaved }) {
  const ui = PLATFORM_UI[channel.platform] || PLATFORM_UI.kick;
  const [form, setForm] = useState({
    notifyChannelId: channel.notifyChannelId,
    mentionRoleId:   channel.mentionRoleId || '',
    mentionEveryone: channel.mentionEveryone,
    messageTemplate: channel.messageTemplate,
    embedColor:      channel.embedColor,
    embedTitle:      channel.embedTitle,
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await socialAPI.update(guildId, channel._id, form);
      toast.success('✅ تم التحديث');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">{ui.emoji}</span>
        <h3 className="text-xl font-bold" dir="ltr">@{channel.channelDisplayName || channel.channelUsername}</h3>
        <button onClick={onClose} className="mr-auto text-white/50"><X size={20} /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">قناة التنبيه</label>
          <select value={form.notifyChannelId} onChange={(e) => setForm({ ...form, notifyChannelId: e.target.value })} className="input">
            {discordChannels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">منشن</label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={form.mentionEveryone} onChange={(e) => setForm({ ...form, mentionEveryone: e.target.checked, mentionRoleId: '' })} />
            @everyone
          </label>
          {!form.mentionEveryone && (
            <select value={form.mentionRoleId} onChange={(e) => setForm({ ...form, mentionRoleId: e.target.value })} className="input">
              <option value="">— بدون —</option>
              {discordRoles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">نص الرسالة</label>
          <textarea value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} rows={2} className="input resize-none" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={submit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            حفظ
          </button>
          <button onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">{children}</div>
    </div>
  );
}
