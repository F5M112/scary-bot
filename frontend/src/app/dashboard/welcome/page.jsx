'use client';
import { useEffect, useState, useRef } from 'react';
import { welcomeAPI, guildsAPI, ticketsAPI } from '@/lib/api';
import { Save, Send, Trash2, Loader2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const VARS = [
  { var: '{user}',     desc: 'منشن العضو' },
  { var: '{username}', desc: 'اسم العضو' },
  { var: '{server}',   desc: 'اسم السيرفر' },
  { var: '{count}',    desc: 'عدد الأعضاء' },
  { var: '{inviter}',  desc: 'من أرسل الرابط' },
  { var: '{invite}',   desc: 'رابط الدعوة' },
];

const DEFAULT = {
  enabled: true, channelId: '', sendAsDM: false,
  message: '【 **WELCOME** 】\n-MEMBER : {user}\n-BY : {inviter}',
  embedEnabled: false, embedColor: '#dc2626', embedTitle: 'أهلاً وسهلاً! 👋',
  embedDescription: 'مرحباً {user} في **{server}**!\nأنت العضو رقم **{count}**',
  embedFooter: 'انضم عبر: {inviter}', embedThumbnail: false, embedImage: false,
  contentImage: false, trackInvites: true,
  cardEnabled: false, cardBackground: '', cardShowAvatar: true,
  cardShowUsername: true, cardShowText: true, cardText: 'welcome to',
  cardTextColor: '#ffffff', cardPosition: 'before', cardChannelId: '',
};

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)}
    className={`w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-green-500' : 'bg-white/20'}`}>
    <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${value ? 'translate-x-5' : ''}`} />
  </button>
);

export default function WelcomePage() {
  const [guilds, setGuilds]       = useState([]);
  const [guild, setGuild]         = useState('');
  const [channels, setChannels]   = useState([]);
  const [form, setForm]           = useState(DEFAULT);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [tab, setTab]             = useState('message');
  const canvasRef = useRef(null);

  useEffect(() => { guildsAPI.list().then(({ data }) => setGuilds(data.guilds)); }, []);

  useEffect(() => {
    if (!guild) return;
    setLoading(true);
    Promise.all([
      welcomeAPI.get(guild).catch(() => ({ data: { welcome: null } })),
      api.get(`/guilds/${guild}/channels`).catch(() => ({ data: { channels: [] } })),
    ]).then(([w, c]) => {
      setForm(w.data.welcome ? { ...DEFAULT, ...w.data.welcome } : DEFAULT);
      setChannels(c.data.channels?.filter(x => x.type === 'text') || []);
    }).finally(() => setLoading(false));
  }, [guild]);

  useEffect(() => {
    if (!canvasRef.current || !form.cardEnabled || tab !== 'card') return;
    drawCard();
  }, [form.cardEnabled, form.cardBackground, form.cardText, form.cardTextColor,
      form.cardShowAvatar, form.cardShowUsername, form.cardShowText, tab, guild]);

  function drawCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 700; canvas.height = 250;

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, 700, 250);

      if (form.cardShowAvatar) {
        ctx.beginPath(); ctx.arc(125, 125, 70, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
        ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 5; ctx.stroke();
        ctx.font = '55px serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#fff'; ctx.fillText('👤', 125, 148);
      }
      if (form.cardShowText && form.cardText) {
        ctx.font = '24px Arial'; ctx.fillStyle = form.cardTextColor || '#fff';
        ctx.textAlign = 'left'; ctx.fillText(form.cardText, 230, 95);
      }
      if (form.cardShowUsername) {
        ctx.font = 'bold 34px Arial'; ctx.fillStyle = '#fff';
        ctx.textAlign = 'left'; ctx.fillText('Username#0000', 230, 148);
      }
      const guildName = guilds.find(g => g.guildId === guild)?.guildName || 'Server Name';
      ctx.font = '17px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left'; ctx.fillText(guildName, 230, 185);
    };

    if (form.cardBackground) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { ctx.drawImage(img, 0, 0, 700, 250); draw(); };
      img.onerror = () => {
        const g = ctx.createLinearGradient(0, 0, 700, 250);
        g.addColorStop(0, '#1a0505'); g.addColorStop(1, '#2d0a0a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 700, 250); draw();
      };
      img.src = form.cardBackground;
    } else {
      const g = ctx.createLinearGradient(0, 0, 700, 250);
      g.addColorStop(0, '#1a0505'); g.addColorStop(1, '#2d0a0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 700, 250); draw();
    }
  }

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const render = (t) => (t||'')
    .replace(/\{user\}/g,'@عضو_جديد').replace(/\{username\}/g,'عضو_جديد')
    .replace(/\{server\}/g, guilds.find(g=>g.guildId===guild)?.guildName||'السيرفر')
    .replace(/\{count\}/g,'١٥٠').replace(/\{inviter\}/g,'أحمد').replace(/\{invite\}/g,'discord.gg/xxxx');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">👋</div>
        <div><h1 className="text-3xl font-bold">رسالة الترحيب</h1><p className="text-white/60">رسالة تلقائية عند انضمام أعضاء جدد</p></div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-2">السيرفر</label>
        <select value={guild} onChange={e=>setGuild(e.target.value)} className="input">
          <option value="">— اختر سيرفراً —</option>
          {guilds.map(g=><option key={g.guildId} value={g.guildId}>{g.guildName}</option>)}
        </select>
      </div>

      {guild && (loading
        ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-500" size={32}/></div>
        : <div className="space-y-4">
            {/* Enable */}
            <div className="card flex items-center justify-between gap-4">
              <div><div className="font-bold text-lg">تفعيل الترحيب</div><div className="text-sm text-white/50">إرسال رسالة عند انضمام عضو جديد</div></div>
              <Toggle value={form.enabled} onChange={v=>upd('enabled',v)}/>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
              {[['message','💬 الرسالة'],['card','🖼️ صورة الترحيب'],['settings','⚙️ إعدادات']].map(([id,label])=>(
                <button key={id} onClick={()=>setTab(id)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${tab===id?'bg-[#1a1a2e] text-white shadow':'text-white/40 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">

                {/* MESSAGE TAB */}
                {tab==='message' && <>
                  <div className="card space-y-3">
                    <label className="font-bold">وجهة الإرسال</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" checked={!form.sendAsDM} onChange={()=>upd('sendAsDM',false)}/> إرسال لقناة
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="radio" checked={form.sendAsDM} onChange={()=>upd('sendAsDM',true)}/> إرسال كـ DM
                      </label>
                    </div>
                    {!form.sendAsDM && (
                      <select value={form.channelId} onChange={e=>upd('channelId',e.target.value)} className="input">
                        <option value="">— اختر قناة —</option>
                        {channels.map(c=><option key={c.id} value={c.id}># {c.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="card">
                    <label className="block text-sm font-medium mb-2">نص الرسالة</label>
                    <textarea value={form.message} onChange={e=>upd('message',e.target.value)} rows={4} className="input resize-none font-mono text-sm"/>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {VARS.map(v=>(
                        <button key={v.var} onClick={()=>upd('message',form.message+v.var)}
                          className="text-xs bg-black/30 px-2 py-1 rounded text-red-300 hover:bg-black/50 transition font-mono">
                          {v.var}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="card space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold">Embed</label>
                      <Toggle value={form.embedEnabled} onChange={v=>upd('embedEnabled',v)}/>
                    </div>
                    {form.embedEnabled && <>
                      <div className="flex gap-2 flex-wrap">
                        {['#dc2626','#5865F2','#23A55A','#FFD700','#9146FF'].map(c=>(
                          <button key={c} onClick={()=>upd('embedColor',c)}
                            className={`w-7 h-7 rounded-full border-4 transition ${form.embedColor===c?'border-white':'border-transparent'}`}
                            style={{backgroundColor:c}}/>
                        ))}
                        <input type="color" value={form.embedColor} onChange={e=>upd('embedColor',e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"/>
                      </div>
                      <input value={form.embedTitle} onChange={e=>upd('embedTitle',e.target.value)} placeholder="العنوان" className="input"/>
                      <textarea value={form.embedDescription} onChange={e=>upd('embedDescription',e.target.value)} rows={2} placeholder="الوصف" className="input resize-none"/>
                      <input value={form.embedFooter} onChange={e=>upd('embedFooter',e.target.value)} placeholder="التذييل" className="input"/>
                      <div className="flex gap-4 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.embedThumbnail} onChange={e=>upd('embedThumbnail',e.target.checked)}/> Thumbnail</label>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.embedImage} onChange={e=>upd('embedImage',e.target.checked)}/> Image كبيرة</label>
                      </div>
                    </>}
                  </div>
                </>}

                {/* CARD TAB */}
                {tab==='card' && <>
                  <div className="card flex items-center justify-between gap-4">
                    <div><div className="font-bold">تفعيل صورة الترحيب</div><div className="text-sm text-white/50">صورة مخصصة مثل ProBot</div></div>
                    <Toggle value={form.cardEnabled} onChange={v=>upd('cardEnabled',v)}/>
                  </div>

                  {form.cardEnabled && <>
                    <div className="card space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">🖼️ رابط صورة الخلفية</label>
                        <input value={form.cardBackground} onChange={e=>upd('cardBackground',e.target.value)} placeholder="https://example.com/bg.png" className="input"/>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">✏️ النص الرئيسي</label>
                        <input value={form.cardText} onChange={e=>upd('cardText',e.target.value)} placeholder="welcome to" className="input"/>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">🎨 لون النص</label>
                        <div className="flex gap-2">
                          {['#ffffff','#dc2626','#FFD700','#23A55A','#5865F2'].map(c=>(
                            <button key={c} onClick={()=>upd('cardTextColor',c)}
                              className={`w-7 h-7 rounded-full border-4 transition ${form.cardTextColor===c?'border-white':'border-transparent'}`}
                              style={{backgroundColor:c}}/>
                          ))}
                          <input type="color" value={form.cardTextColor} onChange={e=>upd('cardTextColor',e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"/>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">عناصر الصورة</label>
                        {[['cardShowAvatar','👤 صورة بروفايل العضو'],['cardShowUsername','📛 اسم العضو'],['cardShowText','✏️ النص الرئيسي']].map(([k,l])=>(
                          <div key={k} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg">
                            <span className="text-sm">{l}</span>
                            <Toggle value={form[k]} onChange={v=>upd(k,v)}/>
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">موضع الصورة</label>
                        {[['before','قبل الرسالة النصية'],['with','مع الرسالة النصية'],['channel','في قناة منفصلة']].map(([v,l])=>(
                          <label key={v} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 text-sm">
                            <input type="radio" checked={form.cardPosition===v} onChange={()=>upd('cardPosition',v)}/> {l}
                          </label>
                        ))}
                        {form.cardPosition==='channel' && (
                          <select value={form.cardChannelId} onChange={e=>upd('cardChannelId',e.target.value)} className="input mt-2">
                            <option value="">— اختر قناة —</option>
                            {channels.map(c=><option key={c.id} value={c.id}># {c.name}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </>}
                </>}

                {/* SETTINGS TAB */}
                {tab==='settings' && <>
                  <div className="card flex items-center justify-between gap-4">
                    <div><div className="font-bold">🔗 تتبع الدعوات</div><div className="text-sm text-white/50">معرفة من أرسل الرابط للعضو</div></div>
                    <Toggle value={form.trackInvites} onChange={v=>upd('trackInvites',v)}/>
                  </div>
                  <div className="card flex items-center justify-between gap-4">
                    <div><div className="font-bold">🖼️ إرسال صورة البروفايل</div><div className="text-sm text-white/50">كـ attachment خارج الـ Embed</div></div>
                    <Toggle value={form.contentImage} onChange={v=>upd('contentImage',v)}/>
                  </div>
                </>}

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={async()=>{if(!form.channelId&&!form.sendAsDM)return toast.error('اختر قناة');setSaving(true);try{await welcomeAPI.save(guild,form);toast.success('✅ تم الحفظ');}catch(e){toast.error(e.response?.data?.error||'فشل');}finally{setSaving(false);}}} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
                    {saving?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>} حفظ
                  </button>
                  <button onClick={async()=>{setTesting(true);try{await welcomeAPI.test(guild);toast.success('✅ تم الإرسال');}catch(e){toast.error(e.response?.data?.error||'فشل');}finally{setTesting(false);}}} disabled={testing} className="btn-secondary flex items-center gap-2 px-4">
                    {testing?<Loader2 className="animate-spin" size={14}/>:<Send size={14}/>} تجربة
                  </button>
                  <button onClick={async()=>{if(!confirm('حذف؟'))return;await welcomeAPI.remove(guild);toast.success('تم الحذف');setForm(DEFAULT);}} className="btn-danger p-2.5"><Trash2 size={16}/></button>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-3">
                <h3 className="font-bold flex items-center gap-2"><Eye size={16}/> معاينة</h3>

                {tab==='card' && form.cardEnabled && (
                  <div>
                    <canvas ref={canvasRef} className="w-full rounded-xl border border-white/10"/>
                    <p className="text-xs text-white/40 mt-1.5 text-center">معاينة تقريبية</p>
                  </div>
                )}

                {tab==='message' && (
                  <div className="bg-[#313338] rounded-xl p-4 text-white text-sm" dir="ltr">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-red-600/30 rounded-full flex items-center justify-center text-xs">🤖</div>
                      <span className="font-bold text-xs">ST Bot</span>
                      <span className="text-white/30 text-xs">اليوم</span>
                    </div>
                    {form.message && <p className="text-white/90 whitespace-pre-wrap text-sm mb-2">{render(form.message)}</p>}
                    {form.embedEnabled && (
                      <div className="rounded-lg overflow-hidden" style={{borderLeft:`4px solid ${form.embedColor}`}}>
                        <div className="bg-[#2B2D31] p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              {form.embedTitle && <div className="font-bold text-sm mb-1" style={{color:form.embedColor}}>{render(form.embedTitle)}</div>}
                              {form.embedDescription && <div className="text-white/80 text-xs whitespace-pre-wrap">{render(form.embedDescription)}</div>}
                              {form.embedFooter && <div className="text-white/40 text-xs mt-2 pt-2 border-t border-white/10">{render(form.embedFooter)}</div>}
                            </div>
                            {form.embedThumbnail && <img src="https://cdn.discordapp.com/embed/avatars/0.png" className="w-12 h-12 rounded-full shrink-0"/>}
                          </div>
                          {form.embedImage && <img src="https://cdn.discordapp.com/embed/avatars/0.png" className="w-full h-20 object-cover rounded-lg mt-2"/>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tab==='settings' && (
                  <div className="card text-center text-white/30 py-8 text-sm">إعدادات إضافية للترحيب</div>
                )}

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200/80">
                  💡 صورة بروفايل العضو الحقيقية ستظهر تلقائياً عند انضمامه
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
