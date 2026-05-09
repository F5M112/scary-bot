'use client';
import { useEffect, useState } from 'react';
import { ticketsAPI, guildsAPI } from '@/lib/api';
import { useT } from '@/lib/i18n';
import {
  Ticket, Plus, Loader2, Hash, MessageSquare, X,
  Trash2, Edit3, Image as ImageIcon, Eye, Save, ArrowLeft, Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STYLE_COLORS = {
  primary:   { bg: '#dc2626', label: 'أحمر',   labelEn: 'Red' },
  secondary: { bg: '#4E5058', label: 'رمادي',  labelEn: 'Gray' },
  success:   { bg: '#23A55A', label: 'أخضر',   labelEn: 'Green' },
  danger:    { bg: '#991b1b', label: 'أحمر داكن',   labelEn: 'Dark Red' },
};

const DEFAULT_PANEL = {
  name: '',
  type: 'button',
  channelId: '',
  embedTitle: '🎫 نظام التذاكر',
  embedDescription: 'اضغط على الزر أدناه لفتح تذكرة جديدة',
  embedColor: '#dc2626',
  embedImage: '',
  embedThumbnail: '',
  embedFooter: '',
  welcomeMessage: 'مرحباً {user}، تم فتح تذكرتك. سيتواصل معك فريق الدعم قريباً.',
  placeholder: 'اختر فئة التذكرة...',
  defaultCategoryId: '',
  options: [
    {
      label: 'دعم عام',
      description: 'احصل على المساعدة',
      emoji: '📩',
      style: 'primary',
      staffRoles: [],
      channelFormat: 'ticket-{user}',
      welcomeMessage: '',
    },
  ],
};

export default function TicketsPage() {
  const t = useT();
  const [guilds, setGuilds] = useState([]);
  const [selectedGuild, setSelectedGuild] = useState('');
  const [panels, setPanels] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [editingPanel, setEditingPanel] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    guildsAPI.list().then(({ data }) => setGuilds(data.guilds));
  }, []);

  useEffect(() => {
    if (selectedGuild) loadAll();
  }, [selectedGuild]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        ticketsAPI.panels(selectedGuild),
        ticketsAPI.list(selectedGuild),
      ]);
      setPanels(pRes.data.panels);
      setTickets(tRes.data.tickets);
    } catch {
      toast.error('فشل التحميل');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePanel = async (id) => {
    if (!confirm(t('confirmDeletePanel'))) return;
    try {
      await ticketsAPI.deletePanel(selectedGuild, id);
      toast.success(t('panelDeleted'));
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    }
  };

  if (editingPanel !== null) {
    return (
      <PanelEditor
        guildId={selectedGuild}
        panel={editingPanel}
        onClose={() => setEditingPanel(null)}
        onSaved={() => { setEditingPanel(null); loadAll(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Ticket className="text-brand-500" size={32} />
          <div>
            <h1 className="text-3xl font-bold">{t('tickets')}</h1>
            <p className="text-white/60">{t('manageTicketsDesc')}</p>
          </div>
        </div>
        {selectedGuild && (
          <button
            onClick={() => setEditingPanel(DEFAULT_PANEL)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> {t('createPanel')}
          </button>
        )}
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-2">{t('selectServer')}</label>
        <select
          value={selectedGuild}
          onChange={(e) => setSelectedGuild(e.target.value)}
          className="input"
        >
          <option value="">— {t('selectServer')} —</option>
          {guilds.map((g) => (
            <option key={g.guildId} value={g.guildId}>{g.guildName}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      )}

      {/* Panels list */}
      {selectedGuild && !loading && (
        <div className="card">
          <h3 className="font-bold mb-4">{t('ticketPanels')}</h3>
          {panels.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <MessageSquare size={36} className="mx-auto mb-2 opacity-50" />
              <p>{t('noServersYet')}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {panels.map((p) => (
                <div key={p._id} className="border border-white/10 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.embedColor + '40' }}>
                    <Ticket style={{ color: p.embedColor }} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-white/50 flex gap-3">
                      <span>{p.type === 'button' ? t('buttons') : t('dropdown')}</span>
                      <span>•</span>
                      <span>{p.options.length} {t('options')}</span>
                    </div>
                  </div>
                  <button onClick={() => setEditingPanel(p)} className="btn-secondary p-2">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDeletePanel(p._id)} className="btn-danger p-2">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tickets list */}
      {selectedGuild && tickets.length > 0 && (
        <div className="card">
          <h3 className="font-bold mb-4">آخر التذاكر</h3>
          <div className="space-y-2">
            {tickets.slice(0, 10).map((tk) => (
              <div key={tk._id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                <Hash className="text-brand-400" size={18} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">#{tk.ticketNumber}</div>
                  <div className="text-xs text-white/50">{tk.createdBy.username} • {new Date(tk.createdAt).toLocaleString()}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  tk.status === 'open' ? 'bg-green-500/20 text-green-300' :
                  tk.status === 'closed' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-red-500/20 text-red-300'
                }`}>
                  {tk.status === 'open' ? t('active') : tk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANEL EDITOR — full builder with live preview
// ═══════════════════════════════════════════════════════════════════
function PanelEditor({ guildId, panel, onClose, onSaved }) {
  const t = useT();
  const [form, setForm] = useState(JSON.parse(JSON.stringify(panel)));
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!form._id;

  useEffect(() => {
    Promise.all([
      ticketsAPI.channels(guildId),
      ticketsAPI.roles(guildId),
    ]).then(([c, r]) => {
      const allCh = c.data.channels;
      setChannels(allCh.filter((x) => x.type === 'text'));
      setCategories(allCh.filter((x) => x.type === 'category'));
      setRoles(r.data.roles);
    }).catch(() => toast.error('فشل في جلب القنوات والأدوار'));
  }, [guildId]);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const updateOption = (i, key, val) => {
    const next = [...form.options];
    next[i] = { ...next[i], [key]: val };
    setForm({ ...form, options: next });
  };

  const addOption = () => {
    if (form.options.length >= 25) return toast.error('الحد الأقصى 25 خيار');
    setForm({
      ...form,
      options: [
        ...form.options,
        {
          label: 'خيار جديد',
          description: '',
          emoji: '📝',
          style: 'secondary',
          staffRoles: [],
          channelFormat: 'ticket-{user}',
          welcomeMessage: '',
        },
      ],
    });
  };

  const removeOption = (i) => {
    if (form.options.length === 1) return toast.error(t('minOneOption'));
    setForm({ ...form, options: form.options.filter((_, idx) => idx !== i) });
  };

  const handleSave = async () => {
    if (!form.name || !form.channelId) return toast.error(t('fillAllFields'));
    if (!form.options || form.options.length === 0) return toast.error(t('minOneOption'));

    setSaving(true);
    try {
      if (isEdit) {
        await ticketsAPI.updatePanel(guildId, form._id, form);
        toast.success(t('panelUpdated'));
      } else {
        await ticketsAPI.createPanel(guildId, form);
        toast.success(t('panelCreated'));
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="btn-secondary p-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? t('editPanel') : t('createPanel')}</h1>
          <p className="text-white/60 text-sm">{form.name || t('panelName')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Basic */}
          <div className="card space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <Edit3 size={16} /> الإعدادات الأساسية
            </h3>
            <Field label={t('panelName')} required>
              <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input" placeholder="الدعم الفني" />
            </Field>

            <Field label={t('panelType')}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => update('type', 'button')}
                  className={`p-3 rounded-lg border-2 transition ${form.type === 'button' ? 'border-brand-500 bg-brand-500/10' : 'border-white/10'}`}
                >
                  {t('buttons')}
                </button>
                <button
                  onClick={() => update('type', 'dropdown')}
                  className={`p-3 rounded-lg border-2 transition ${form.type === 'dropdown' ? 'border-brand-500 bg-brand-500/10' : 'border-white/10'}`}
                >
                  {t('dropdown')}
                </button>
              </div>
            </Field>

            <Field label={t('channel')} required>
              <select value={form.channelId} onChange={(e) => update('channelId', e.target.value)} className="input" disabled={isEdit}>
                <option value="">— {t('selectChannel')} —</option>
                {channels.map((c) => <option key={c.id} value={c.id}># {c.name}</option>)}
              </select>
            </Field>

            <Field label="📁 فئة قنوات التذاكر (Category)" hint="ستُنشأ كل التذاكر داخل هذه الفئة في ديسكورد">
              <select value={form.defaultCategoryId || ''} onChange={(e) => update('defaultCategoryId', e.target.value)} className="input">
                <option value="">— بدون فئة (في الجذر) —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
              </select>
            </Field>

            {form.type === 'dropdown' && (
              <Field label={t('placeholder')}>
                <input value={form.placeholder} onChange={(e) => update('placeholder', e.target.value)} className="input" />
              </Field>
            )}
          </div>

          {/* Embed */}
          <div className="card space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <Palette size={16} /> {t('embedTitle')}
            </h3>
            <Field label={t('embedTitle')}>
              <input value={form.embedTitle} onChange={(e) => update('embedTitle', e.target.value)} className="input" />
            </Field>
            <Field label={t('embedDescription')}>
              <textarea value={form.embedDescription} onChange={(e) => update('embedDescription', e.target.value)} className="input resize-none" rows={3} />
            </Field>
            <Field label={t('embedColor')}>
              <div className="flex gap-2">
                <input type="color" value={form.embedColor} onChange={(e) => update('embedColor', e.target.value)} className="w-14 h-11 rounded-lg cursor-pointer bg-transparent border border-white/10" />
                <input type="text" value={form.embedColor} onChange={(e) => update('embedColor', e.target.value)} className="input flex-1 font-mono" dir="ltr" />
              </div>
            </Field>
            <Field label={t('embedThumbnail') + ` (${t('optional')})`}>
              <input value={form.embedThumbnail || ''} onChange={(e) => update('embedThumbnail', e.target.value)} className="input" placeholder="https://..." dir="ltr" />
            </Field>
            <Field label={t('embedImage') + ` (${t('optional')})`}>
              <input value={form.embedImage || ''} onChange={(e) => update('embedImage', e.target.value)} className="input" placeholder="https://..." dir="ltr" />
            </Field>
            <Field label={t('embedFooter') + ` (${t('optional')})`}>
              <input value={form.embedFooter || ''} onChange={(e) => update('embedFooter', e.target.value)} className="input" />
            </Field>
          </div>

          {/* Welcome message */}
          <div className="card">
            <Field label={t('welcomeMessage')}>
              <textarea value={form.welcomeMessage} onChange={(e) => update('welcomeMessage', e.target.value)} className="input resize-none" rows={2} />
              <p className="text-xs text-white/50 mt-1">{`{user}`} = المستخدم</p>
            </Field>
          </div>

          {/* Options */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">{t('options')} ({form.options.length})</h3>
              <button onClick={addOption} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1">
                <Plus size={14} /> {t('addOption')}
              </button>
            </div>
            <div className="space-y-3">
              {form.options.map((opt, i) => (
                <OptionEditor
                  key={i}
                  option={opt}
                  index={i}
                  panelType={form.type}
                  roles={roles}
                  categories={categories}
                  onChange={(key, val) => updateOption(i, key, val)}
                  onRemove={() => removeOption(i)}
                  canRemove={form.options.length > 1}
                  t={t}
                />
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-2 sticky bottom-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isEdit ? t('save') : t('create')}
            </button>
            <button onClick={onClose} className="btn-secondary py-3">{t('cancel')}</button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <div className="card">
            <div className="flex items-center gap-2 mb-3 text-sm text-white/60">
              <Eye size={14} /> {t('livePreview')}
            </div>
            <p className="text-xs text-white/40 mb-4">{t('panelPreview')}</p>
            <DiscordPreview panel={form} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

function OptionEditor({ option, index, panelType, roles, categories, onChange, onRemove, canRemove, t }) {
  return (
    <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-black/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">#{index + 1}</span>
        {canRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-300">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          value={option.label}
          onChange={(e) => onChange('label', e.target.value)}
          placeholder={t('optionLabel')}
          className="input"
        />
        <input
          value={option.emoji || ''}
          onChange={(e) => onChange('emoji', e.target.value)}
          placeholder="📩"
          className="input text-center"
        />
      </div>

      {panelType === 'dropdown' && (
        <input
          value={option.description || ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder={t('optionDescription')}
          className="input"
        />
      )}

      {panelType === 'button' && (
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t('optionStyle')}</label>
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(STYLE_COLORS).map(([key, v]) => (
              <button
                key={key}
                onClick={() => onChange('style', key)}
                className={`p-2 rounded-lg text-xs font-bold text-white border-2 transition ${
                  option.style === key ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: v.bg }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-white/60 hover:text-white">⚙️ خيارات متقدمة (اختياري)</summary>
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-xs text-white/60 block mb-1">{t('staffRoles')}</label>
            <select
              multiple
              value={option.staffRoles || []}
              onChange={(e) => onChange('staffRoles', Array.from(e.target.selectedOptions, (o) => o.value))}
              className="input min-h-24"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id} style={{ color: r.color !== '#000000' ? r.color : undefined }}>
                  @{r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">📁 فئة خاصة بهذا الخيار (تجاوز الفئة الافتراضية)</label>
            <select
              value={option.ticketCategoryId || ''}
              onChange={(e) => onChange('ticketCategoryId', e.target.value)}
              className="input"
            >
              <option value="">— استخدم الفئة الافتراضية —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>📁 {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">{t('channelFormat')}</label>
            <input
              value={option.channelFormat || ''}
              onChange={(e) => onChange('channelFormat', e.target.value)}
              placeholder="ticket-{user}"
              className="input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-white/60 block mb-1">{t('customWelcome')}</label>
            <textarea
              value={option.welcomeMessage || ''}
              onChange={(e) => onChange('welcomeMessage', e.target.value)}
              placeholder={t('leaveEmptyForDefault')}
              className="input resize-none"
              rows={2}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIVE DISCORD PREVIEW — mimics Discord's UI
// ═══════════════════════════════════════════════════════════════════
function DiscordPreview({ panel }) {
  return (
    <div className="bg-[#313338] rounded-lg p-4 text-white" dir="ltr">
      {/* Bot user line */}
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-lg shrink-0">
          🎫
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white">Tickets Bot</span>
            <span className="text-[10px] bg-[#5865F2] text-white px-1 py-0.5 rounded font-bold">BOT</span>
            <span className="text-xs text-white/40">Today</span>
          </div>

          {/* Embed */}
          <div className="border-l-4 rounded-md bg-[#2B2D31] overflow-hidden max-w-md" style={{ borderColor: panel.embedColor || '#5865F2' }}>
            <div className="p-3" dir={hasArabic(panel.embedTitle + panel.embedDescription) ? 'rtl' : 'ltr'}>
              {/* Header with thumbnail */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  {panel.embedTitle && (
                    <div className="font-bold text-base mb-1 break-words">{panel.embedTitle}</div>
                  )}
                  {panel.embedDescription && (
                    <div className="text-sm text-white/80 whitespace-pre-wrap break-words">{panel.embedDescription}</div>
                  )}
                </div>
                {panel.embedThumbnail && (
                  <img src={panel.embedThumbnail} alt="" className="w-16 h-16 rounded object-cover shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                )}
              </div>

              {/* Big image */}
              {panel.embedImage && (
                <img src={panel.embedImage} alt="" className="mt-3 max-w-full rounded" onError={(e) => { e.target.style.display = 'none'; }} />
              )}

              {/* Footer */}
              {panel.embedFooter && (
                <div className="text-xs text-white/50 mt-2">{panel.embedFooter}</div>
              )}
            </div>
          </div>

          {/* Buttons or dropdown */}
          <div className="mt-2 max-w-md" dir={hasArabic(panel.options?.[0]?.label) ? 'rtl' : 'ltr'}>
            {panel.type === 'button' ? (
              <div className="flex flex-wrap gap-2">
                {panel.options.map((opt, i) => (
                  <button
                    key={i}
                    className="px-4 py-2 rounded text-white text-sm font-medium transition hover:opacity-90"
                    style={{ backgroundColor: STYLE_COLORS[opt.style]?.bg || '#5865F2' }}
                  >
                    <span>{opt.emoji} {opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-[#1E1F22] border border-white/10 rounded p-3 max-w-sm">
                <div className="text-white/60 text-sm flex items-center justify-between">
                  <span>{panel.placeholder}</span>
                  <span>▼</span>
                </div>
                <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                  {panel.options.slice(0, 3).map((opt, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded hover:bg-white/5">
                      <span className="text-lg">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{opt.label}</div>
                        {opt.description && <div className="text-xs text-white/50">{opt.description}</div>}
                      </div>
                    </div>
                  ))}
                  {panel.options.length > 3 && (
                    <div className="text-xs text-white/40 text-center py-1">+ {panel.options.length - 3} المزيد</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(text || '');
}
