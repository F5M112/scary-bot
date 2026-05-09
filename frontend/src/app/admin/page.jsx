'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import {
  ShieldAlert, Users, Server, Megaphone, Ticket, Crown,
  Loader2, Search, AlertTriangle, Plus, X, Eye, EyeOff,
  KeyRound, Trash2, LogOut, Edit3, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const { user, fetchUser, logout } = useAuthStore();
  const router = useRouter();
  const t = useT();
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('users');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) {
      fetchUser().then((u) => {
        if (!u) router.replace('/login');
        else if (u.role !== 'admin') { setError(true); router.replace('/login'); }
      });
    } else if (user.role !== 'admin') {
      setError(true);
      router.replace('/login');
    }

    adminAPI.stats()
      .then(({ data }) => setStats(data))
      .catch(() => setError(true));
  }, [user, fetchUser, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card text-center max-w-md">
          <AlertTriangle className="text-red-400 mx-auto mb-3" size={40} />
          <h1 className="text-xl font-bold mb-2">{t('accessDenied')}</h1>
          <p className="text-white/60">{t('accessDeniedDesc')}</p>
        </div>
      </div>
    );
  }

  if (!stats || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-500" size={40} /></div>;
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <h1 className="text-3xl font-bold">{t('adminPanel')}</h1>
              <p className="text-brand-400 text-sm">{t('adminWarning')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button onClick={logout} className="btn-secondary flex items-center gap-2 text-sm">
              <LogOut size={14} /> {t('logout')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}    label={t('users')}   value={stats.users.total}     color="blue" />
          <StatCard icon={Crown}    label={t('premium')} value={stats.users.premium}   color="purple" />
          <StatCard icon={Server}   label={t('servers')} value={stats.guilds.total}    color="green" />
          <StatCard icon={Ticket}   label={t('tickets')} value={stats.tickets}         color="amber" />
        </div>

        <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
          {[
            { id: 'users',      label: t('usersTab'),      icon: Users },
            { id: 'guilds',     label: t('guildsTab'),     icon: Server },
            { id: 'broadcasts', label: t('broadcastsTab'), icon: Megaphone },
          ].map((tt) => (
            <button
              key={tt.id}
              onClick={() => setTab(tt.id)}
              className={`px-4 py-2.5 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                tab === tt.id ? 'border-red-500 text-red-400' : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              <tt.icon size={16} /> {tt.label}
            </button>
          ))}
        </div>

        {tab === 'users'      && <UsersTab t={t} />}
        {tab === 'guilds'     && <GuildsTab t={t} />}
        {tab === 'broadcasts' && <BroadcastsTab t={t} />}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const bg = {
    blue:   'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green:  'bg-green-500/20 text-green-400',
    amber:  'bg-amber-500/20 text-amber-400',
  }[color];
  return (
    <div className="card">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold">{(value || 0).toLocaleString()}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════════
function UsersTab({ t }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [editUser, setEditUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.users({ search });
      setUsers(data.users);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setPlan = async (id, plan) => {
    let duration = 30;
    if (plan !== 'none') {
      const input = prompt('المدة بالأيام:', '30');
      if (!input) return;
      duration = parseInt(input);
    }
    try {
      const { data } = await adminAPI.setPlan(id, plan, duration);
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    }
  };

  const handleAction = async (action, id) => {
    if (action === 'delete') {
      if (!confirm('سيتم حذف الحساب وكل سيرفراته نهائياً. هل أنت متأكد؟')) return;
    }
    try {
      let res;
      switch (action) {
        case 'ban': {
          const reason = prompt('سبب الحظر:');
          if (reason === null) return;
          res = await adminAPI.banUser(id, reason);
          break;
        }
        case 'unban':   res = await adminAPI.unbanUser(id);   break;
        case 'disable': res = await adminAPI.disableUser(id); break;
        case 'enable':  res = await adminAPI.enableUser(id);  break;
        case 'delete':  res = await adminAPI.deleteUser(id);  break;
      }
      toast.success(res.data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو معرف السيرفر..."
              className="input ltr:pl-10 rtl:pr-10"
            />
          </div>
          <button type="submit" className="btn-secondary">{t('search')}</button>
        </form>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> إنشاء حساب جديد
        </button>
      </div>

      {loading ? <Loader2 className="animate-spin mx-auto text-brand-500" size={32} /> : (
        users.length === 0 ? (
          <div className="card text-center py-12 text-white/50">
            <Users size={40} className="mx-auto mb-3 opacity-50" />
            لا توجد حسابات بعد. اضغط "إنشاء حساب جديد" للبدء.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 border-b border-white/10">
                  <th className="py-3 px-2 text-start">الحساب</th>
                  <th className="py-3 px-2 text-start">حساب ديسكورد</th>
                  <th className="py-3 px-2 text-start">{t('plan')}</th>
                  <th className="py-3 px-2 text-start">الحالة</th>
                  <th className="py-3 px-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-2">
                      <div className="font-medium">{u.displayName || u.username}</div>
                      <div className="text-xs text-white/40 font-mono" dir="ltr">@{u.username}</div>
                    </td>
                    <td className="py-3 px-2">
                      {u.discordUsername ? (
                        <div className="flex items-center gap-2">
                          {u.discordAvatar && (
                            <img src={`https://cdn.discordapp.com/avatars/${u.discordId}/${u.discordAvatar}.png`} className="w-6 h-6 rounded-full" alt="" />
                          )}
                          <span className="text-xs">{u.discordUsername}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">— غير مرتبط —</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={u.plan}
                        onChange={(e) => setPlan(u._id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                      >
                        <option value="none">{t('none')}</option>
                        <option value="classic">{t('classic')}</option>
                        <option value="premium">{t('premium')}</option>
                      </select>
                    </td>
                    <td className="py-3 px-2 text-xs">
                      {u.isBanned   && <div className="text-red-400">محظور</div>}
                      {u.isDisabled && <div className="text-amber-400">معطل</div>}
                      {!u.isBanned && !u.isDisabled && <div className="text-green-400">{t('active')}</div>}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setEditUser(u)} title="تعديل" className="text-xs p-1.5 bg-white/5 hover:bg-white/10 rounded">
                          <Edit3 size={12} />
                        </button>
                        <button onClick={() => setResetUser(u)} title="إعادة تعيين كلمة المرور" className="text-xs p-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 rounded">
                          <KeyRound size={12} />
                        </button>
                        {!u.isBanned ? (
                          <button onClick={() => handleAction('ban', u._id)} className="btn-danger text-xs py-1 px-2">{t('ban')}</button>
                        ) : (
                          <button onClick={() => handleAction('unban', u._id)} className="btn-secondary text-xs py-1 px-2">{t('unban')}</button>
                        )}
                        {!u.isDisabled ? (
                          <button onClick={() => handleAction('disable', u._id)} className="text-xs py-1 px-2 bg-amber-600/20 text-amber-300 rounded">{t('disable')}</button>
                        ) : (
                          <button onClick={() => handleAction('enable', u._id)} className="text-xs py-1 px-2 bg-green-600/20 text-green-300 rounded">{t('enable')}</button>
                        )}
                        <button onClick={() => handleAction('delete', u._id)} title="حذف" className="text-xs p-1.5 bg-red-600/20 text-red-300 hover:bg-red-600/40 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {resetUser  && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
      {editUser   && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onUpdated={() => { setEditUser(null); load(); }} />}
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    username:    '',
    password:    '',
    displayName: '',
    plan:        'none',
    planDuration:'30',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const generatePwd = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, password: pwd });
    setShowPwd(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminAPI.createUser({
        ...form,
        planDuration: parseInt(form.planDuration),
      });
      toast.success('✅ تم إنشاء الحساب');
      setCreated({ username: form.username, password: form.password });
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = () => {
    const text = `اسم المستخدم: ${created.username}\nكلمة المرور: ${created.password}\nرابط الدخول: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ البيانات');
  };

  if (created) {
    return (
      <Modal onClose={onCreated}>
        <div className="text-center mb-4">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-xl font-bold mb-1">تم إنشاء الحساب بنجاح</h3>
          <p className="text-sm text-white/60">شارك هذه البيانات مع المستخدم</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4 space-y-3 mb-4">
          <Row label="اسم المستخدم" value={created.username} />
          <Row label="كلمة المرور"   value={created.password} mono />
          <Row label="رابط الدخول"   value={`${window.location.origin}/login`} mono />
        </div>
        <div className="flex gap-2">
          <button onClick={copyAll} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Copy size={14} /> نسخ كل البيانات
          </button>
          <button onClick={onCreated} className="btn-primary flex-1">حسناً</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">إنشاء حساب جديد</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم المستخدم *" hint="بالإنجليزية، أرقام، _ ، -">
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="user_server1"
            className="input"
            dir="ltr"
            pattern="[a-zA-Z0-9_-]{3,30}"
            minLength={3}
            maxLength={30}
            required
          />
        </Field>

        <Field label="كلمة المرور * (6 أحرف على الأقل)">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input ltr:pr-10 rtl:pl-10"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-white/50"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="button" onClick={generatePwd} className="btn-secondary text-xs px-3">
              توليد عشوائي
            </button>
          </div>
        </Field>

        <Field label="الاسم الظاهر (اختياري)">
          <input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="مثل: مالك سيرفر الألعاب"
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الباقة">
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="input"
            >
              <option value="none">لا توجد</option>
              <option value="classic">كلاسيك</option>
              <option value="premium">بريميوم</option>
            </select>
          </Field>
          {form.plan !== 'none' && (
            <Field label="مدة الاشتراك (أيام)">
              <input
                type="number"
                value={form.planDuration}
                onChange={(e) => setForm({ ...form, planDuration: e.target.value })}
                min="1"
                className="input"
              />
            </Field>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="animate-spin" size={14} />}
            إنشاء
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────
function ResetPasswordModal({ user, onClose }) {
  const [pwd, setPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pwd.length < 6) return toast.error('كلمة المرور 6 أحرف على الأقل');
    setSubmitting(true);
    try {
      await adminAPI.resetPassword(user._id, pwd);
      toast.success('✅ تم تغيير كلمة المرور');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">إعادة تعيين كلمة المرور</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <p className="text-sm text-white/60 mb-4">
        تغيير كلمة المرور للمستخدم: <span className="font-mono text-white" dir="ltr">@{user.username}</span>
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="كلمة المرور الجديدة">
          <input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="input"
            minLength={6}
            required
          />
        </Field>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'حفظ'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────
function EditUserModal({ user, onClose, onUpdated }) {
  const [form, setForm] = useState({ displayName: user.displayName || '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminAPI.updateUser(user._id, form);
      toast.success('✅ تم التحديث');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'فشل');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">تعديل الحساب</h3>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم المستخدم (لا يمكن تغييره)">
          <input value={user.username} disabled className="input opacity-50" />
        </Field>
        <Field label="الاسم الظاهر">
          <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input" />
        </Field>
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'حفظ'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── GUILDS TAB ───────────────────────────────────────────────────
function GuildsTab({ t }) {
  const [guilds, setGuilds] = useState([]);
  useEffect(() => { adminAPI.guilds().then(({ data }) => setGuilds(data.guilds)); }, []);

  const toggle = async (g) => {
    try {
      if (g.adminDisabled) {
        await adminAPI.forceEnableGuild(g.guildId);
        toast.success('تم التفعيل');
      } else {
        const reason = prompt('سبب الإيقاف:') || 'بدون سبب';
        await adminAPI.forceDisableGuild(g.guildId, reason);
        toast.success('تم الإيقاف');
      }
      const { data } = await adminAPI.guilds();
      setGuilds(data.guilds);
    } catch {
      toast.error(t('error'));
    }
  };

  return (
    <div className="space-y-3">
      {guilds.length === 0 ? (
        <div className="card text-center py-12 text-white/50">لا توجد سيرفرات مسجلة.</div>
      ) : guilds.map((g) => (
        <div key={g.guildId} className="card flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-bold">{g.guildName || g.guildId}</div>
            <div className="text-xs text-white/40 font-mono" dir="ltr">{g.guildId}</div>
            <div className="text-xs text-white/60 mt-1">
              المالك: {g.ownerId?.displayName || g.ownerId?.username || '—'} •
              {g.plan} • {g.botMode} • {g.enabled ? '✅' : '🛑'}
              {g.adminDisabled && ' (إيقاف إداري)'}
            </div>
          </div>
          <button onClick={() => toggle(g)} className={g.adminDisabled ? 'btn-secondary' : 'btn-danger'}>
            {g.adminDisabled ? t('forceEnable') : t('forceDisable')}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── BROADCASTS TAB ───────────────────────────────────────────────
function BroadcastsTab({ t }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => { adminAPI.broadcasts().then(({ data }) => setLogs(data.logs)); }, []);

  return (
    <div className="space-y-3">
      {logs.length === 0 ? (
        <div className="card text-center py-12 text-white/50">لا توجد إذاعات.</div>
      ) : logs.map((log) => (
        <div key={log._id} className="card">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="text-xs text-white/60">من: {log.sentBy?.username || '—'}</span>
            <span className="text-xs text-white/40">{new Date(log.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-sm text-white/80 mb-2 line-clamp-2">{log.message}</div>
          <div className="flex gap-3 text-xs text-white/60">
            <span>{log.mode === 'global' ? '🌐' : '🎯'}</span>
            <span className="text-green-400">✓ {log.sentCount}</span>
            <span className="text-red-400">✗ {log.failedCount}</span>
            <span>الإجمالي: {log.totalRecipients}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function Row({ label, value, mono }) {
  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success('تم النسخ');
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/50">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${mono ? 'font-mono' : ''}`} dir="ltr">{value}</span>
        <button onClick={copy} className="text-white/40 hover:text-white"><Copy size={12} /></button>
      </div>
    </div>
  );
}
