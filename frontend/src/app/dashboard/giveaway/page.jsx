'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import {
  giveawayAPI,
  guildsAPI,
  ticketsAPI,
} from '@/lib/api';

import { useAuthStore } from '@/lib/store';
import { useT } from '@/lib/i18n';

import {
  Gift,
  Plus,
  Trash2,
  Loader2,
  X,
  Trophy,
  RotateCcw,
  StopCircle,
  Clock3,
  Crown,
  CalendarClock,
  Users,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';

import toast from 'react-hot-toast';

export default function GiveawayPage() {
  const { user } = useAuthStore();
  const t = useT();

  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');

  const [giveaways, setGiveaways] = useState([]);
  const [channels, setChannels] = useState([]);

  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    guildsAPI.list().then(({ data }) => {
      setGuilds(data.guilds || []);
    });
  }, []);

  useEffect(() => {
    if (selectedGuild) {
      loadAll();
    }
  }, [selectedGuild]);

  const loadAll = async () => {
    setLoading(true);

    try {
      const [g, c] = await Promise.all([
        giveawayAPI.list(selectedGuild),

        ticketsAPI
          .channels(selectedGuild)
          .catch(() => ({ data: { channels: [] } })),
      ]);

      setGiveaways(g.data.giveaways || []);

      setChannels(
        c.data.channels?.filter((x) => x.type === 'text') || []
      );
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const active = useMemo(
    () => giveaways.filter((g) => g.status === 'active'),
    [giveaways]
  );

  const ended = useMemo(
    () => giveaways.filter((g) => g.status === 'ended'),
    [giveaways]
  );

  const handleEnd = async (id) => {
    if (!confirm('سيتم إنهاء المسابقة الآن واختيار الفائزين. تأكيد؟')) return;

    try {
      await giveawayAPI.end(selectedGuild, id);

      toast.success('تم إنهاء المسابقة');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    }
  };

  const handleReroll = async (id) => {
    if (!confirm('سيتم إعادة السحب واختيار فائزين جدد. تأكيد؟')) return;

    try {
      await giveawayAPI.reroll(selectedGuild, id);

      toast.success('تم إعادة السحب');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('سيتم حذف المسابقة نهائياً. تأكيد؟')) return;

    try {
      await giveawayAPI.delete(selectedGuild, id);

      toast.success('تم حذف المسابقة');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    }
  };

  return (
    <div className="space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#121212] via-[#171717] to-[#0D0D0D] p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,215,0,0.15),transparent_30%)]" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-yellow-500/10 blur-3xl rounded-full" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full text-sm mb-5">
              <Sparkles size={15} />
              نظام مسابقات احترافي
            </div>

            <h1 className="text-4xl font-black leading-tight">
              🎉 Giveaway Dashboard
            </h1>

            <p className="text-white/60 mt-3 max-w-2xl leading-7">
              أنشئ مسابقات احترافية داخل الديسكورد مع سحب تلقائي للفائزين،
              ألوان مخصصة، قوانين، وإدارة كاملة للمسابقات.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <QuickStat
                icon={<Clock3 size={18} />}
                title="نشطة"
                value={active.length}
                color="green"
              />

              <QuickStat
                icon={<Trophy size={18} />}
                title="منتهية"
                value={ended.length}
                color="yellow"
              />

              <QuickStat
                icon={<Gift size={18} />}
                title="الإجمالي"
                value={giveaways.length}
                color="purple"
              />
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur">
              <label className="block text-sm font-medium mb-2 text-white/70">
                اختر السيرفر
              </label>

              <select
                value={selectedGuild}
                onChange={(e) => setSelectedGuild(e.target.value)}
                className="input"
              >
                <option value="">
                  — {t('selectServer')} —
                </option>

                {guilds.map((g) => (
                  <option key={g.guildId} value={g.guildId}>
                    {g.guildName}
                  </option>
                ))}
              </select>

              {selectedGuild && (
                <div className="mt-5">
                  {user?.plan !== 'premium' &&
                  giveaways.length >= 1 ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Crown className="text-amber-300" size={18} />
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold text-amber-200">
                            انتهت التجربة المجانية
                          </p>

                          <p className="text-sm text-amber-100/70 mt-1">
                            قم بالترقية لإنشاء مسابقات غير محدودة.
                          </p>

                          <Link
                            href="/dashboard/subscription"
                            className="inline-flex mt-3 text-sm bg-amber-400 hover:bg-amber-300 text-black font-bold px-4 py-2 rounded-xl transition"
                          >
                            ترقية الآن
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full mt-2 bg-gradient-to-r from-yellow-500 to-amber-400 hover:opacity-90 text-black font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition"
                    >
                      <Plus size={18} />
                      إنشاء مسابقة
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-yellow-400" size={40} />
        </div>
      )}

      {/* ACTIVE */}
      {selectedGuild && !loading && active.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center">
              <Clock3 className="text-green-400" size={18} />
            </div>

            <div>
              <h2 className="text-2xl font-black">
                المسابقات النشطة
              </h2>

              <p className="text-white/50 text-sm">
                جميع المسابقات التي مازالت تعمل حالياً
              </p>
            </div>
          </div>

          <div className="grid gap-5">
            {active.map((g) => (
              <GiveawayCard
                key={g._id}
                g={g}
                channels={channels}
                onEnd={handleEnd}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* ENDED */}
      {selectedGuild && !loading && ended.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center">
              <Trophy className="text-yellow-400" size={18} />
            </div>

            <div>
              <h2 className="text-2xl font-black">
                المسابقات المنتهية
              </h2>

              <p className="text-white/50 text-sm">
                مسابقات تم اختيار الفائزين بها
              </p>
            </div>
          </div>

          <div className="grid gap-5">
            {ended.map((g) => (
              <GiveawayCard
                key={g._id}
                g={g}
                channels={channels}
                onReroll={handleReroll}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* EMPTY */}
      {selectedGuild &&
        !loading &&
        giveaways.length === 0 && (
          <div className="border border-dashed border-white/10 rounded-3xl p-16 text-center bg-white/[0.02]">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-6">
              <Gift className="text-yellow-400" size={42} />
            </div>

            <h3 className="text-2xl font-black mb-2">
              لا توجد مسابقات
            </h3>

            <p className="text-white/50 max-w-md mx-auto leading-7">
              قم بإنشاء أول Giveaway لسيرفرك وابدأ بالسحب على الجوائز.
            </p>

            <button
              onClick={() => setShowCreate(true)}
              className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-2xl inline-flex items-center gap-2 transition"
            >
              <Plus size={18} />
              إنشاء مسابقة
            </button>
          </div>
        )}

      {/* MODAL */}
      <AnimatePresence>
        {showCreate && (
          <CreateGiveawayModal
            guildId={selectedGuild}
            channels={channels}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              loadAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   CARD                                     */
/* -------------------------------------------------------------------------- */

function GiveawayCard({
  g,
  channels,
  onEnd,
  onReroll,
  onDelete,
}) {
  const isActive = g.status === 'active';

  const channelName =
    channels.find((c) => c.id === g.channelId)?.name ||
    g.channelId;

  const [remaining, setRemaining] = useState(
    Math.max(0, new Date(g.endAt) - Date.now())
  );

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setRemaining(
        Math.max(0, new Date(g.endAt) - Date.now())
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [g.endAt, isActive]);

  const formatTime = (ms) => {
    const sec = Math.floor(ms / 1000);

    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    if (d > 0) return `${d} يوم`;
    if (h > 0) return `${h} ساعة`;
    if (m > 0) return `${m} دقيقة`;

    return `${s} ثانية`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-3xl border backdrop-blur p-6 ${
        isActive
          ? 'border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      {/* Glow */}
      <div
        className={`absolute top-0 right-0 w-52 h-52 blur-3xl rounded-full ${
          isActive
            ? 'bg-green-500/10'
            : 'bg-yellow-500/10'
        }`}
      />

      <div className="relative">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/20 flex items-center justify-center text-3xl shrink-0">
            🎉
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-black truncate">
                {g.title}
              </h3>

              {isActive ? (
                <div className="px-3 py-1 rounded-full bg-green-500/15 border border-green-500/20 text-green-300 text-xs font-bold animate-pulse">
                  🟢 نشطة
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-bold">
                  ⚫ منتهية
                </div>
              )}
            </div>

            <div className="mt-2 text-yellow-300 text-lg font-black">
              🏆 {g.prize}
            </div>

            {g.description && (
              <p className="mt-3 text-white/60 leading-7">
                {g.description}
              </p>
            )}
          </div>
        </div>

        {/* RULES */}
        {g.rules && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-bold mb-2 flex items-center gap-2">
              <BadgeCheck
                className="text-blue-400"
                size={16}
              />
              القوانين
            </div>

            <div className="text-sm text-white/60 whitespace-pre-wrap leading-7">
              {g.rules}
            </div>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <StatBox
            icon={<Users size={18} />}
            label="المشتركون"
            value={g.participants.length}
          />

          <StatBox
            icon={<Trophy size={18} />}
            label="الفائزين"
            value={g.winnersCount}
          />

          <StatBox
            icon={<Gift size={18} />}
            label="القناة"
            value={`#${channelName}`}
          />

          <StatBox
            icon={<CalendarClock size={18} />}
            label={
              isActive ? 'الوقت المتبقي' : 'تاريخ الانتهاء'
            }
            value={
              isActive
                ? formatTime(remaining)
                : new Date(g.endAt).toLocaleDateString('ar-SA')
            }
          />
        </div>

        {/* WINNERS */}
        {!isActive && g.winners?.length > 0 && (
          <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
            <div className="flex items-center gap-2 text-yellow-300 font-bold mb-3">
              <Trophy size={17} />
              الفائزون
            </div>

            <div className="flex flex-wrap gap-2">
              {g.winners.map((w, i) => (
                <div
                  key={i}
                  className="bg-black/30 border border-yellow-500/20 text-yellow-100 text-sm px-3 py-1.5 rounded-full font-mono"
                >
                  @{w.slice(-6)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-3 mt-6">
          {isActive && (
            <button
              onClick={() => onEnd(g._id)}
              className="bg-red-500/15 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-5 py-3 rounded-2xl flex items-center gap-2 font-medium transition"
            >
              <StopCircle size={16} />
              إنهاء الآن
            </button>
          )}

          {!isActive && (
            <button
              onClick={() => onReroll(g._id)}
              className="bg-blue-500/15 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 px-5 py-3 rounded-2xl flex items-center gap-2 font-medium transition"
            >
              <RotateCcw size={16} />
              إعادة السحب
            </button>
          )}

          <button
            onClick={() => onDelete(g._id)}
            className="bg-red-950/30 hover:bg-red-950/50 border border-red-900/30 text-red-400 px-5 py-3 rounded-2xl flex items-center gap-2 font-medium transition"
          >
            <Trash2 size={16} />
            حذف
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STATS                                    */
/* -------------------------------------------------------------------------- */

function QuickStat({ icon, title, value, color }) {
  const colors = {
    green:
      'bg-green-500/10 border-green-500/20 text-green-300',

    yellow:
      'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',

    purple:
      'bg-purple-500/10 border-purple-500/20 text-purple-300',
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${colors[color]}`}
    >
      <div>{icon}</div>

      <div>
        <div className="text-xs opacity-70">
          {title}
        </div>

        <div className="font-black text-lg">
          {value}
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="w-11 h-11 mx-auto rounded-xl bg-white/5 flex items-center justify-center mb-3">
        {icon}
      </div>

      <div className="font-black truncate">
        {value}
      </div>

      <div className="text-xs text-white/50 mt-1">
        {label}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   MODAL                                    */
/* -------------------------------------------------------------------------- */

function CreateGiveawayModal({
  guildId,
  channels,
  onClose,
  onCreated,
}) {
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    prize: '',
    rules: '',
    winnersCount: 1,
    endAt: '',
    channelId: '',
    embedColor: '#FFD700',
  });

  useEffect(() => {
    const d = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    const local = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    setForm((f) => ({
      ...f,
      endAt: local,
    }));
  }, []);

  const update = (key, value) => {
    setForm((f) => ({
      ...f,
      [key]: value,
    }));
  };

  const submit = async () => {
    if (
      !form.title ||
      !form.prize ||
      !form.channelId ||
      !form.endAt
    ) {
      return toast.error(
        'العنوان والجائزة والقناة والتاريخ مطلوبة'
      );
    }

    if (new Date(form.endAt) <= new Date()) {
      return toast.error(
        'يجب أن يكون التاريخ في المستقبل'
      );
    }

    setSubmitting(true);

    try {
      await giveawayAPI.create(guildId, form);

      toast.success(
        'تم إنشاء المسابقة بنجاح'
      );

      onCreated();
    } catch (err) {
      toast.error(
        err.response?.data?.error || 'فشل'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#111111] p-7"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-3xl font-black flex items-center gap-3">
              <Gift className="text-yellow-400" size={26} />
              إنشاء Giveaway
            </h3>

            <p className="text-white/50 mt-2">
              قم بتخصيص المسابقة بالكامل
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <Input
              label="عنوان المسابقة"
              value={form.title}
              onChange={(e) =>
                update('title', e.target.value)
              }
              placeholder="مثل: Giveaway Nitro"
            />

            <Input
              label="الجائزة"
              value={form.prize}
              onChange={(e) =>
                update('prize', e.target.value)
              }
              placeholder="Nitro - PayPal - Steam"
            />

            <div>
              <label className="block mb-2 text-sm font-medium text-white/70">
                القناة
              </label>

              <select
                value={form.channelId}
                onChange={(e) =>
                  update('channelId', e.target.value)
                }
                className="input"
              >
                <option value="">
                  — اختر قناة —
                </option>

                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    # {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              type="number"
              label="عدد الفائزين"
              value={form.winnersCount}
              onChange={(e) =>
                update(
                  'winnersCount',
                  Math.max(
                    1,
                    Math.min(
                      50,
                      parseInt(e.target.value) || 1
                    )
                  )
                )
              }
            />

            <div className="lg:col-span-2">
              <Input
                type="datetime-local"
                label="تاريخ الانتهاء"
                value={form.endAt}
                onChange={(e) =>
                  update('endAt', e.target.value)
                }
              />
            </div>
          </div>

          <Textarea
            label="الوصف"
            value={form.description}
            onChange={(e) =>
              update('description', e.target.value)
            }
            rows={3}
            placeholder="وصف المسابقة..."
          />

          <Textarea
            label="القوانين"
            value={form.rules}
            onChange={(e) =>
              update('rules', e.target.value)
            }
            rows={4}
            placeholder="1- ممنوع الحسابات الوهمية..."
          />

          {/* COLORS */}
          <div>
            <label className="block mb-3 text-sm font-medium text-white/70">
              لون الرسالة
            </label>

            <div className="flex flex-wrap gap-3">
              {[
                '#FFD700',
                '#FF6B6B',
                '#5865F2',
                '#23A55A',
                '#FF69B4',
                '#00BFFF',
                '#FF8800',
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() =>
                    update('embedColor', color)
                  }
                  className={`w-12 h-12 rounded-2xl border-4 transition-all ${
                    form.embedColor === color
                      ? 'border-white scale-110'
                      : 'border-transparent'
                  }`}
                  style={{
                    backgroundColor: color,
                  }}
                />
              ))}
            </div>
          </div>

          {/* PREVIEW */}
          <div className="rounded-3xl bg-[#2B2D31] border border-white/10 p-5">
            <div className="text-xs text-white/50 mb-4">
              📱 معاينة الرسالة
            </div>

            <div
              className="border-r-4 rounded-2xl bg-black/20 p-5"
              style={{
                borderColor: form.embedColor,
              }}
            >
              <div className="text-2xl font-black mb-2">
                🎉 {form.title || 'عنوان المسابقة'}
              </div>

              {form.description && (
                <div className="text-white/70 mb-4 leading-7">
                  {form.description}
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div>
                  🏆 <b>الجائزة:</b>{' '}
                  {form.prize || '...'}
                </div>

                <div>
                  👥 <b>عدد الفائزين:</b>{' '}
                  {form.winnersCount}
                </div>

                <div>
                  👤 <b>المشتركين:</b> 0
                </div>
              </div>

              {form.rules && (
                <div className="mt-5">
                  <div className="font-bold mb-2">
                    📋 القوانين
                  </div>

                  <div className="text-white/60 text-sm whitespace-pre-wrap leading-7">
                    {form.rules}
                  </div>
                </div>
              )}
            </div>

            <button className="mt-4 bg-[#23A55A] hover:opacity-90 text-white px-5 py-2 rounded-xl font-bold transition">
              🎉 اشترك بالمسابقة
            </button>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-4 pt-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-400 hover:opacity-90 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition"
            >
              {submitting ? (
                <Loader2
                  className="animate-spin"
                  size={18}
                />
              ) : (
                <Gift size={18} />
              )}

              {submitting
                ? 'جاري الإنشاء...'
                : 'إنشاء المسابقة'}
            </button>

            <button
              onClick={onClose}
              className="px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                INPUTS UI                                   */
/* -------------------------------------------------------------------------- */

function Input({
  label,
  ...props
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-white/70">
        {label}
      </label>

      <input
        {...props}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 outline-none focus:border-yellow-500/50 transition"
      />
    </div>
  );
}

function Textarea({
  label,
  ...props
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium text-white/70">
        {label}
      </label>

      <textarea
        {...props}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 outline-none focus:border-yellow-500/50 transition resize-none"
      />
    </div>
  );
}
