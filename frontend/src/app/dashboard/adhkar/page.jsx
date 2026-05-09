'use client';
import { useEffect, useState } from 'react';
import { adhkarAPI, guildsAPI, ticketsAPI } from '@/lib/api';
import {
  Loader2, Save, Send, Bookmark, Power, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PRESET_INTERVALS = [
  { value: 15,   label: 'كل 15 دقيقة' },
  { value: 30,   label: 'كل 30 دقيقة' },
  { value: 60,   label: 'كل ساعة' },
  { value: 120,  label: 'كل ساعتين' },
  { value: 180,  label: 'كل 3 ساعات' },
  { value: 360,  label: 'كل 6 ساعات' },
  { value: 720,  label: 'كل 12 ساعة' },
  { value: 1440, label: 'مرة باليوم' },
];

export default function AdhkarPage() {
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [discordChannels, setDiscordChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    guildsAPI.list().then(({ data }) => setGuilds(data.guilds));
    adhkarAPI.categories().then(({ data }) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    if (selectedGuild) loadAll();
  }, [selectedGuild]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        adhkarAPI.get(selectedGuild),
        ticketsAPI.channels(selectedGuild).catch(() => ({ data: { channels: [] } })),
      ]);
      setSettings(s.data.settings);
      setDiscordChannels(c.data.channels?.filter((x) => x.type === 'text') || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل التحميل');
    } finally {
      setLoading(false);
    }
  };

  const update = (key, val) => setSettings((s) => ({ ...s, [key]: val }));

  const toggleCategory = (catId) => {
    const cats = settings.categories || [];
    if (cats.includes(catId)) {
      update('categories', cats.filter((c) => c !== catId));
    } else {
      update('categories', [...cats, catId]);
    }
  };

  const handleSave = async () => {
    if (settings.enabled && !settings.channelId) {
      return toast.error('اختر قناة قبل التفعيل');
    }
    if (!settings.categories || settings.categories.length === 0) {
      return toast.error('اختر فئة واحدة على الأقل');
    }
    setSaving(true);
    try {
      await adhkarAPI.save(selectedGuild, {
        enabled:         settings.enabled,
        channelId:       settings.channelId,
        intervalMinutes: settings.intervalMinutes,
        categories:      settings.categories,
        embedColor:      settings.embedColor,
        embedTitle:      settings.embedTitle,
      });
      toast.success('✅ تم الحفظ');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await adhkarAPI.test(selectedGuild);
      toast.success('✅ تم إرسال رسالة تجريبية');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally {
      setTesting(false);
    }
  };

  const totalAvailable = (settings?.categories || [])
    .reduce((sum, cat) => sum + (categories.find((c) => c.id === cat)?.count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <Bookmark className="text-emerald-400" size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">📿 الأذكار التلقائية</h1>
          <p className="text-white/60">إرسال أذكار وأدعية تلقائياً في قناة محددة</p>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-2">السيرفر</label>
        <select value={selectedGuild} onChange={(e) => setSelectedGuild(e.target.value)} className="input">
          <option value="">— اختر سيرفراً —</option>
          {guilds.map((g) => <option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
        </select>
      </div>

      {selectedGuild && loading && (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
      )}

      {selectedGuild && !loading && settings && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Master switch */}
            <div className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                  <Power size={18} />
                </div>
                <div>
                  <div className="font-bold">تفعيل الإرسال التلقائي</div>
                  <div className="text-xs text-white/50">{settings.enabled ? 'النظام شغّال' : 'النظام متوقف'}</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => update('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-white/10 rounded-full peer-checked:bg-emerald-500 transition relative">
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${settings.enabled ? 'right-0.5' : 'right-6'}`} />
                </div>
              </label>
            </div>

            {/* Channel */}
            <div className="card">
              <label className="block text-sm font-medium mb-2">قناة الإرسال</label>
              <select value={settings.channelId || ''} onChange={(e) => update('channelId', e.target.value)} className="input">
                <option value="">— اختر قناة —</option>
                {discordChannels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </div>

            {/* Interval */}
            <div className="card">
              <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                <Clock size={16} /> الفترة الزمنية بين كل رسالة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {PRESET_INTERVALS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => update('intervalMinutes', p.value)}
                    className={`p-2 rounded-lg border text-sm transition ${
                      settings.intervalMinutes === p.value
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 text-white/70 hover:border-white/20'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/60">أو حدد بالدقائق:</span>
                <input
                  type="number"
                  value={settings.intervalMinutes}
                  onChange={(e) => update('intervalMinutes', Math.max(5, Math.min(1440, parseInt(e.target.value) || 60)))}
                  min={5}
                  max={1440}
                  className="input w-24"
                />
                <span className="text-white/60">دقيقة</span>
              </div>
            </div>

            {/* Categories */}
            <div className="card">
              <label className="block text-sm font-medium mb-3">الفئات المفعّلة ({(settings.categories || []).length})</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const active = (settings.categories || []).includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`p-3 rounded-lg border text-right transition ${
                        active
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{cat.label}</span>
                        {active && <CheckCircle2 className="text-emerald-400" size={14} />}
                      </div>
                      <div className="text-xs text-white/40 mt-1">{cat.count} عنصر</div>
                    </button>
                  );
                })}
              </div>
              {totalAvailable > 0 && (
                <div className="mt-3 text-xs text-white/50 text-center">
                  📊 إجمالي المحتوى المتاح: <span className="text-emerald-400 font-bold">{totalAvailable}</span> عنصر
                </div>
              )}
            </div>

            {/* Customization */}
            <div className="card">
              <label className="block text-sm font-medium mb-2">عنوان الرسالة (Embed Title)</label>
              <input
                value={settings.embedTitle || ''}
                onChange={(e) => update('embedTitle', e.target.value)}
                placeholder="📿 ذكر"
                className="input mb-4"
              />
              <label className="block text-sm font-medium mb-2">لون الرسالة</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.embedColor || '#1a8754'}
                  onChange={(e) => update('embedColor', e.target.value)}
                  className="w-14 h-11 rounded-lg cursor-pointer bg-transparent border border-white/10"
                />
                <input
                  type="text"
                  value={settings.embedColor || '#1a8754'}
                  onChange={(e) => update('embedColor', e.target.value)}
                  className="input flex-1 font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 sticky bottom-4">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                حفظ الإعدادات
              </button>
              <button onClick={handleTest} disabled={testing || !settings.channelId} className="btn-secondary flex items-center gap-2">
                {testing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                إرسال تجريبي
              </button>
            </div>
          </div>

          {/* Stats sidebar */}
          <div className="space-y-4">
            <div className="card bg-gradient-to-br from-emerald-950/20 to-[#15090a] border-emerald-500/30">
              <div className="text-xs text-white/60 mb-1">إجمالي الرسائل المرسلة</div>
              <div className="text-3xl font-black text-emerald-400">{settings.totalSent || 0}</div>
            </div>

            <div className="card">
              <div className="text-xs text-white/60 mb-2">آخر إرسال</div>
              <div className="text-sm">
                {settings.lastSentAt
                  ? new Date(settings.lastSentAt).toLocaleString('ar-SA')
                  : 'لم يُرسل بعد'}
              </div>
            </div>

            <div className="card bg-blue-500/10 border-blue-500/20">
              <div className="flex gap-2 text-sm">
                <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
                <div className="text-blue-200/90">
                  <div className="font-bold mb-1">معلومة:</div>
                  يتم اختيار الذكر بشكل عشوائي مع تجنّب التكرار المباشر.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
