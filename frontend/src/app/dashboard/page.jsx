'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { guildsAPI, authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT, useI18n } from '@/lib/i18n';
import {
  Server, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight,
  Ticket, Megaphone, Bot, AlertCircle, Crown, Plus, Link as LinkIcon, Unlink,
  Radio, Bookmark,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardHome() {
  const { user, fetchUser } = useAuthStore();
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const params = useSearchParams();
  const router = useRouter();

  const [registeredGuilds, setRegisteredGuilds] = useState([]);
  const [discordGuilds, setDiscordGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [registering, setRegistering] = useState(null);

  // Handle redirect from Discord OAuth
  useEffect(() => {
    if (params.get('discord_linked') === '1') {
      toast.success('✅ تم ربط حساب ديسكورد بنجاح');
      fetchUser();
      router.replace('/dashboard');
    }
    const err = params.get('discord_error');
    if (err) {
      const messages = {
        already_linked: 'هذا الحساب مربوط بمستخدم آخر',
        invalid_state:  'انتهت صلاحية الجلسة. حاول مرة ثانية',
        oauth_failed:   'فشل الاتصال بديسكورد',
        missing_params: 'بيانات ناقصة',
      };
      toast.error(messages[err] || `خطأ: ${err}`);
      router.replace('/dashboard');
    }
  }, [params, router, fetchUser]);

  const load = async () => {
    setLoading(true);
    try {
      const reg = await guildsAPI.list();
      setRegisteredGuilds(reg.data.guilds);

      if (user?.isDiscordLinked) {
        try {
          const dis = await authAPI.discordGuilds();
          setDiscordGuilds(dis.data.guilds || []);
          if (dis.data.tokenExpired) {
            toast.error('انتهت صلاحية ربط ديسكورد. أعد الربط من الزر أدناه.');
            await fetchUser(); // refresh user to show unlinked state
          }
        } catch {
          setDiscordGuilds([]);
        }
      }
    } catch {
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleLinkDiscord = async () => {
    setLinking(true);
    try {
      const { data } = await authAPI.linkDiscord();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
      setLinking(false);
    }
  };

  const handleUnlinkDiscord = async () => {
    if (!confirm('سيتم فصل حساب ديسكورد. هل أنت متأكد؟')) return;
    try {
      await authAPI.unlinkDiscord();
      toast.success('تم فصل حساب ديسكورد');
      fetchUser();
      setDiscordGuilds([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    }
  };

  const handleRegisterGuild = async (g) => {
    setRegistering(g.id);
    try {
      await guildsAPI.register({
        guildId:   g.id,
        guildName: g.name,
        guildIcon: g.icon,
      });
      toast.success(`✅ تم تسجيل ${g.name}`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل التسجيل');
    } finally {
      setRegistering(null);
    }
  };

  const handleUnregisterGuild = async (guildId, name) => {
    if (!confirm(`سيتم إزالة "${name}" من حسابك. هل أنت متأكد؟`)) return;
    try {
      await guildsAPI.unregister(guildId);
      toast.success('تم الإزالة');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  }

  const registeredIds = new Set(registeredGuilds.map((g) => g.guildId));
  const availableGuilds = discordGuilds.filter((g) => !registeredIds.has(g.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-1">{t('welcome')}، {user?.displayName || user?.username} 👋</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/60">باقتك:</span>
          {user?.plan === 'premium'
            ? <span className="badge-premium flex items-center gap-1"><Crown size={12} /> {t('premium')}</span>
            : <span className="badge-classic">{t('classic')}</span>}
        </div>
      </div>

      {/* Discord Link Section */}
      {!user?.isDiscordLinked ? (
        <div className="card bg-gradient-to-br from-[#15090a] to-blue-950/20 border-blue-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#5865F2]/20 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold mb-1">اربط حساب ديسكورد</h3>
              <p className="text-sm text-white/60 mb-4">
                لإدارة سيرفراتك، اربط حساب ديسكورد لعرض السيرفرات التي أنت مشرف فيها.
              </p>
              <button
                onClick={handleLinkDiscord}
                disabled={linking}
                className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition"
              >
                {linking ? <Loader2 className="animate-spin" size={16} /> : <LinkIcon size={16} />}
                ربط حساب ديسكورد
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card flex items-center gap-4 flex-wrap">
          <img
            src={user.discordAvatar
              ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.discordAvatar}.png`
              : 'https://cdn.discordapp.com/embed/avatars/0.png'}
            alt=""
            className="w-12 h-12 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold">{user.discordUsername}</span>
              <CheckCircle2 className="text-green-400" size={14} />
            </div>
            <div className="text-xs text-white/50">حساب ديسكورد مرتبط</div>
          </div>
          <button onClick={handleUnlinkDiscord} className="btn-secondary text-sm flex items-center gap-2">
            <Unlink size={14} /> فصل
          </button>
        </div>
      )}

      {/* Registered Servers */}
      <section>
        <h2 className="text-xl font-bold mb-4">سيرفراتي المُدارة</h2>
        {registeredGuilds.length === 0 ? (
          <div className="card text-center py-12">
            <Server className="mx-auto text-white/30 mb-4" size={48} />
            <p className="text-white/60">لم تقم بتسجيل أي سيرفر بعد</p>
            <p className="text-sm text-white/40 mt-2">
              {user?.isDiscordLinked
                ? 'اختر سيرفراً من القائمة أدناه للبدء'
                : 'اربط حساب ديسكورد أولاً لعرض سيرفراتك'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {registeredGuilds.map((g) => (
              <div key={g.guildId} className="card hover:border-brand-500/40 transition flex items-center gap-4 group">
                <div className="w-14 h-14 rounded-xl bg-brand-600/20 flex items-center justify-center overflow-hidden shrink-0">
                  {g.guildIcon ? (
                    <img src={`https://cdn.discordapp.com/icons/${g.guildId}/${g.guildIcon}.png`} alt={g.guildName} className="w-full h-full object-cover" />
                  ) : (
                    <Server className="text-brand-400" size={24} />
                  )}
                </div>
                <Link href={`/dashboard/server/${g.guildId}`} className="flex-1 min-w-0">
                  <div className="font-bold truncate">{g.guildName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {g.enabled && !g.adminDisabled ? (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> {t('enabled')}
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <XCircle size={12} /> {t('disabled')}
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => handleUnregisterGuild(g.guildId, g.guildName)}
                  title="إزالة"
                  className="text-white/30 hover:text-red-400 p-2"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Available Discord Servers (to register) */}
      {user?.isDiscordLinked && availableGuilds.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-2">سيرفرات يمكن إضافتها</h2>
          <p className="text-sm text-white/50 mb-4">السيرفرات التي تملك صلاحية المشرف فيها</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableGuilds.map((g) => (
              <div key={g.id} className="card flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                  {g.icon ? (
                    <img src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`} alt={g.name} className="w-full h-full object-cover" />
                  ) : (
                    <Server className="text-white/40" size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{g.name}</div>
                  <div className="text-xs text-white/40">{g.owner ? '👑 مالك' : '🛡️ مشرف'}</div>
                </div>
                <button
                  onClick={() => handleRegisterGuild(g)}
                  disabled={registering === g.id}
                  className="btn-primary p-2"
                  title="تسجيل"
                >
                  {registering === g.id ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {user?.isDiscordLinked && discordGuilds.length === 0 && (
        <div className="card bg-amber-500/5 border-amber-500/20 text-center py-8">
          <AlertCircle className="text-amber-400 mx-auto mb-2" size={32} />
          <p className="text-white/70">لم يتم العثور على سيرفرات تملك صلاحية المشرف فيها</p>
        </div>
      )}
    </div>
  );
}
