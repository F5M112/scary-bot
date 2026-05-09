'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { guildsAPI, botAPI } from '@/lib/api';
import {
  Server, Power, Settings, Loader2, CheckCircle2,
  XCircle, Bot, Hash, Crown,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ServerDetailPage() {
  const { guildId } = useParams();
  const [guild, setGuild] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    try {
      const [g, s] = await Promise.all([
        guildsAPI.get(guildId),
        botAPI.status(guildId),
      ]);
      setGuild(g.data.guild);
      setStatus(s.data);
    } catch {
      toast.error('فشل التحميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const toggle = async () => {
    setToggling(true);
    try {
      const { data } = await guildsAPI.toggle(guildId);
      toast.success(data.message);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  if (!guild) return <p className="text-center text-white/60 py-20">السيرفر غير موجود</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <img
          src={guild.guildIcon
            ? `https://cdn.discordapp.com/icons/${guild.guildId}/${guild.guildIcon}.png`
            : `https://cdn.discordapp.com/embed/avatars/0.png`}
          alt={guild.guildName}
          className="w-16 h-16 rounded-2xl"
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{guild.guildName}</h1>
          <p className="text-white/40 text-sm font-mono" dir="ltr">{guild.guildId}</p>
        </div>
        <button
          onClick={toggle}
          disabled={toggling || guild.adminDisabled}
          className={guild.enabled ? 'btn-danger' : 'btn-primary'}
        >
          {toggling ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />}
          {guild.enabled ? 'إيقاف' : 'تفعيل'}
        </button>
      </div>

      {/* Admin Disabled Warning */}
      {guild.adminDisabled && (
        <div className="card bg-red-500/10 border-red-500/30">
          <div className="flex gap-3">
            <XCircle className="text-red-400 shrink-0" size={20} />
            <div>
              <div className="font-bold text-red-300">السيرفر معطل من الإدارة</div>
              <div className="text-sm text-red-200/70 mt-1">
                {guild.adminDisabledReason || 'تواصل مع الدعم لمزيد من التفاصيل.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard
          icon={Server}
          label="الحالة"
          value={guild.enabled ? 'مفعل' : 'معطل'}
          good={guild.enabled}
        />
        <InfoCard
          icon={Bot}
          label="نوع البوت"
          value={guild.botMode === 'custom' ? 'مخصص' : 'الرئيسي'}
          good={status?.online}
        />
        <InfoCard
          icon={Crown}
          label="الباقة"
          value={guild.plan === 'premium' ? 'بريميوم' : 'كلاسيك'}
          good={guild.plan === 'premium'}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/tickets" className="card hover:border-brand-500/40 transition group">
          <Hash className="text-brand-400 mb-2 group-hover:scale-110 transition" size={24} />
          <div className="font-bold mb-1">إدارة التذاكر</div>
          <div className="text-sm text-white/60">إنشاء لوحات، عرض التذاكر</div>
        </Link>

        <Link href="/dashboard/broadcast" className="card hover:border-brand-500/40 transition group">
          <div className="flex items-center justify-between mb-2">
            <Crown className="text-brand-400" size={24} />
            {guild.plan !== 'premium' && <span className="text-xs text-brand-400">مميز فقط</span>}
          </div>
          <div className="font-bold mb-1">نظام الإذاعة</div>
          <div className="text-sm text-white/60">إرسال رسائل خاصة جماعية</div>
        </Link>

        <Link href="/dashboard/bot" className="card hover:border-brand-500/40 transition group">
          <Bot className="text-brand-400 mb-2 group-hover:scale-110 transition" size={24} />
          <div className="font-bold mb-1">إعدادات البوت</div>
          <div className="text-sm text-white/60">ربط بوت مخصص (مميز)</div>
        </Link>
      </div>

      {/* Stats */}
      <div className="card">
        <h3 className="font-bold mb-4">إحصائيات</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="عدد التذاكر" value={guild.ticketCount} />
          <Stat label="لوحات التذاكر" value={guild.ticketPanels?.length || 0} />
          <Stat label="تاريخ التسجيل" value={new Date(guild.createdAt).toLocaleDateString('ar-SA')} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, good }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={good ? 'text-green-400' : 'text-amber-400'} size={20} />
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
