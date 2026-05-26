import { useState, useEffect, useCallback } from 'react'
import { fetchAllData, fetchMonthlyStats, fetchAllDebtPayments,
         calcAllWorkers, calcSalary, saveShift, updateShift, saveBonusRecord,
         saveAdvance, saveDebtPayment, addDebt, addStaff, addFixedStaff,
         updateStaffRates, updateFixedSalary, updateStaffInfo, deleteStaff,
         updateStaffToggles, saveSettings, checkAccess, writeLog, DEFAULT_CFG,
         fetchShipmentRefs, fetchShipments, saveShipment, deleteShipment,
         addFirm, addMaterial, addSize, calcShipmentStats } from './notion.js'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const OWNER_IDS = (import.meta.env.VITE_OWNER_IDS||'').split(',').map(x=>Number(x.trim())).filter(Boolean)
const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень']
const MONTHS_SHORT = ['Січ','Лют','Бер','Квіт','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']

// Мотиваційні фрази
const MOTIV = [
  '💪 Кожна година наближає до цілі!',
  '🔥 Ти в ударі цього місяця!',
  '⭐ Продовжуй у тому ж дусі!',
  '🏆 До бонусу рукою подати!',
  '💰 Гроші самі себе не заробляють — але ти заробляєш!',
  '🪵 Пиляй впевнено, заробляй гарно!',
  '🚀 Ще трохи і бонус твій!',
  '💎 Стабільність — ключ до успіху!',
]
const randomMotiv = () => MOTIV[Math.floor(Math.random()*MOTIV.length)]

// Вібрація через Telegram
const vibrate = (type='light') => {
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type) } catch(e){}
}

const C = {
  bg:'#0b1017',surface:'#111820',surface2:'#161f2a',
  border:'rgba(56,189,248,0.12)',border2:'rgba(56,189,248,0.06)',
  accent:'#38bdf8',gold:'#f59e0b',green:'#22c55e',
  red:'#f87171',muted:'#4a6070',text:'#e2f0f9',dim:'#6b8fa8',purple:'#a78bfa',
  w:['#38bdf8','#22c55e','#f59e0b','#a78bfa','#fb7185','#34d399','#60a5fa','#f472b6'],
}
const fmt  = n => Math.round(n||0).toLocaleString('uk-UA')
const fmtH = n => Number(n||0).toFixed(1)
const todayStr = () => new Date().toISOString().slice(0,10)
const inp = {background:'rgba(255,255,255,0.05)',border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:'11px 14px',fontSize:15,fontFamily:'inherit',width:'100%',outline:'none',WebkitAppearance:'none'}

// ── UI Primitives ──────────────────────────────────────────
const Card = ({children,top,style={}}) =>
  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px 18px',...(top?{borderTop:`2px solid ${top}`}:{}),overflowX:'hidden',...style}}>{children}</div>
const Lbl = ({children}) =>
  <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>{children}</div>
const SecTitle = ({children,right}) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
    <div style={{fontSize:10,color:C.accent,letterSpacing:2,textTransform:'uppercase'}}>{children}</div>
    {right}
  </div>
const Row = ({label,value,color=C.text,bold=false,last=false,sub}) =>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:last?'none':`1px solid ${C.border}`,fontSize:13}}>
    <div><span style={{color:C.dim}}>{label}</span>{sub&&<div style={{fontSize:10,color:C.muted}}>{sub}</div>}</div>
    <span style={{color,fontWeight:bold?700:400,marginLeft:8,textAlign:'right'}}>{value}</span>
  </div>
const Prog = ({val,max,color}) =>
  <div style={{height:5,borderRadius:3,background:`${color}22`,overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.min(100,(val/Math.max(max,1))*100)}%`,background:color,borderRadius:3,transition:'width .4s'}}/>
  </div>

function Sheet({onClose,title,children}) {
  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'flex-end',zIndex:200}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'16px 16px 0 0',padding:'20px 20px 44px',width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{width:40,height:4,background:C.muted,borderRadius:2,margin:'0 auto 16px'}}/>
      {title&&<div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:18}}>{title}</div>}
      {children}
    </div>
  </div>
}

function Header({title,sub,onRefresh,onBack,right}) {
  return <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      {onBack&&<button onClick={onBack} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:8,padding:'5px 10px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>←</button>}
      <div>
        <div style={{fontSize:14,fontWeight:700,color:C.accent,letterSpacing:1}}>{title}</div>
        {sub&&<div style={{fontSize:10,color:C.muted}}>{sub}</div>}
      </div>
    </div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      {right}
      {onRefresh&&<button onClick={onRefresh} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:8,padding:'6px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>↻</button>}
    </div>
  </div>
}

function Spinner() {
  return <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
    <div style={{fontSize:40}}>🪵</div>
    <style>{`@keyframes sl{0%{transform:translateX(-200%)}100%{transform:translateX(400%)}}`}</style>
    <div style={{color:C.accent,fontSize:11,letterSpacing:3}}>ЗАВАНТАЖЕННЯ...</div>
    <div style={{width:120,height:2,background:C.border,borderRadius:2,overflow:'hidden'}}>
      <div style={{height:'100%',width:'40%',background:C.accent,borderRadius:2,animation:'sl 1s ease-in-out infinite'}}/>
    </div>
  </div>
}

function MonthPicker({year,month,onChange}) {
  const now = new Date()
  return <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
    {Array.from({length:6},(_,i)=>{
      const d = new Date(now.getFullYear(), now.getMonth()-5+i)
      const y = d.getFullYear(), m = d.getMonth()
      const active = y===year&&m===month
      return <button key={i} onClick={()=>onChange(y,m)} style={{whiteSpace:'nowrap',padding:'6px 12px',borderRadius:20,border:`1px solid ${active?C.accent:C.border}`,background:active?'rgba(56,189,248,0.1)':'transparent',color:active?C.accent:C.muted,cursor:'pointer',fontSize:11,fontFamily:'inherit',flexShrink:0}}>
        {MONTHS_SHORT[m]} {y!==now.getFullYear()?y:''}
      </button>
    })}
  </div>
}

const TTip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return <div style={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:11}}>
    <div style={{color:C.accent,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:p.color||C.text}}>{p.name}: {fmt(p.value)} грн</div>)}
  </div>
}

function DaysExpand({days,rateHour,ratePack,longDayHours=10,onEdit,isOwner}) {
  const [open,setOpen] = useState(false)
  if (!days?.length) return null
  return <div>
    <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',background:'rgba(56,189,248,0.05)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',color:C.accent,cursor:'pointer',fontSize:12,fontFamily:'inherit',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>📅 По днях ({days.length})</span>
      <span>{open?'▲':'▼'}</span>
    </button>
    {open&&<div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6}}>
      {days.map(d=>{
        const earn = d.hours*(rateHour||0)+d.packs*(ratePack||0)
        const isLong = d.hours>=longDayHours
        return <div key={d.date} style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:isLong?C.gold:C.dim}}>{d.date} {isLong?'⭐':''}</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{color:C.green,fontWeight:600}}>{fmt(earn)} грн</span>
              {isOwner&&onEdit&&<button onClick={()=>onEdit(d)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:4,padding:'2px 6px',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>}
            </div>
          </div>
          <div style={{display:'flex',gap:12,fontSize:11,color:C.muted}}>
            {d.hours>0&&<span>⏱ {fmtH(d.hours)} год</span>}
            {d.packs>0&&<span>📦 {d.packs} пачок</span>}
          </div>
        </div>
      })}
    </div>}
  </div>
}

// ── Зарплатний листок ──────────────────────────────────────
function PayslipModal({w,month,year,onClose}) {
  const lines = [
    `🪵 ПИЛОРАМА`,
    `━━━━━━━━━━━━━━━`,
    `👤 ${w.name}`,
    `📅 ${MONTHS_UA[month]} ${year}`,
    `━━━━━━━━━━━━━━━`,
    w.type==='shift'?`⏱ Годин: ${fmtH(w.totalHours)} год`:'',
    w.type==='shift'?`📦 Пачок: ${w.totalPacks} шт`:'',
    w.type==='shift'?`📅 Робочих днів: ${w.workDays}`:'',
    `━━━━━━━━━━━━━━━`,
    w.type==='shift'?`💰 Погодинно: ${fmt(w.earnHours)} грн`:'',
    w.type==='shift'?`📦 Пачки: ${fmt(w.earnPacks)} грн`:'',
    w.type==='fixed'?`💰 Фікс. ставка: ${fmt(w.gross)} грн`:'',
    w.bonusLong>0?`⭐ Бонус 10+ год: +${fmt(w.bonusLong)} грн`:'',
    w.bonusSat>0?`📅 Бонус суботи: +${fmt(w.bonusSat)} грн`:'',
    w.premium>0?`🏆 Премія: +${fmt(w.premium)} грн`:'',
    w.manualBonus>0?`🎁 Ручна премія: +${fmt(w.manualBonus)} грн`:'',
    `━━━━━━━━━━━━━━━`,
    `📊 Нараховано: ${fmt(w.gross)} грн`,
    w.totalAdv>0?`➖ Аванси: -${fmt(w.totalAdv)} грн`:'',
    w.debtPaid>0?`➖ Борг: -${fmt(w.debtPaid)} грн`:'',
    `━━━━━━━━━━━━━━━`,
    `✅ ДО ВИПЛАТИ: ${fmt(w.final)} грн`,
  ].filter(Boolean).join('\n')

  return <Sheet onClose={onClose} title="📄 Зарплатний листок">
    <div style={{background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,padding:16,fontFamily:'monospace',fontSize:13,color:C.text,lineHeight:1.8,whiteSpace:'pre-wrap',marginBottom:16}}>
      {lines}
    </div>
    <button onClick={()=>{
      if (navigator.share) navigator.share({text:lines})
      else if (navigator.clipboard) { navigator.clipboard.writeText(lines); vibrate('medium') }
    }} style={{width:'100%',background:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
      📋 Скопіювати / Поділитись
    </button>
  </Sheet>
}

// ── Редагування дня ────────────────────────────────────────
function EditDayForm({day,worker,onClose,onSaved,tgId,tgName,cfg}) {
  const [hours,   setHours]   = useState(day.hours)
  const [packs,   setPacks]   = useState(day.packs)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      // Оновлюємо всі записи за цей день
      for (const id of day.ids||[]) {
        await updateShift(id, {
          hours: parseFloat(hours)||0,
          packs: parseFloat(packs)||0,
          rateHour: worker.rateHour||0,
          ratePack: worker.ratePack||0,
          lunchBreak: 0, // вже враховано раніше
        })
      }
      await writeLog({tgId,name:tgName,action:`Редагування дня: ${worker.name}`,details:`${day.date}: ${hours}год ${packs}пач`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`✏️ Редагувати ${day.date}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ГОДИНИ</Lbl>
        <input type="number" inputMode="decimal" step="0.5" value={hours} onChange={e=>setHours(e.target.value)} style={inp}/>
      </div>
      <div><Lbl>ПАЧКИ</Lbl>
        <input type="number" inputMode="numeric" value={packs} onChange={e=>setPacks(e.target.value)} style={inp}/>
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Зберегти'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ЗМІНИ
// ================================================================
function ShiftForm({worker,allWorkers,isOwner,onClose,onSaved,tgId,tgName,cfg}) {
  const lb = cfg?.lunchBreak??1
  const [selId,   setSelId]   = useState(worker?.tgId||tgId)
  const [type,    setType]    = useState('hours')
  const [date,    setDate]    = useState(todayStr())
  const [hours,   setHours]   = useState('')
  const [packs,   setPacks]   = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const [result,  setResult]  = useState(null)
  const [motiv]               = useState(randomMotiv())

  const sel = isOwner ? (allWorkers.find(w=>w.tgId===Number(selId))||worker) : worker
  const rawH = parseFloat(hours)||0
  const actualH = Math.max(0, rawH - lb)
  const earn = actualH*(sel?.rateHour||0)+(parseFloat(packs)||0)*(sel?.ratePack||0)

  async function submit(e) {
    e.preventDefault()
    const h = type==='packs'?0:parseFloat(hours)||0
    const pk = type==='hours'?0:parseFloat(packs)||0
    if (!h&&!pk) return
    try {
      setLoading(true); setError(null)
      await saveShift({tgId:sel.tgId,name:sel.name,rateHour:sel.rateHour||0,ratePack:sel.ratePack||0,date,hours:h,packs:pk,lunchBreak:lb})
      await writeLog({tgId:isOwner?tgId:sel.tgId,name:sel.name,action:'Зміна',details:`${date}: ${h}год ${pk}пач`})
      vibrate('success')
      setResult({hours:h,actualH:Math.max(0,h-lb),packs:pk,earned:Math.max(0,h-lb)*(sel.rateHour||0)+pk*(sel.ratePack||0),date})
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},3000)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  if (success&&result) return <Sheet onClose={onClose} title="✅ Зміну внесено!">
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:'rgba(34,197,94,0.08)',border:`1px solid rgba(34,197,94,0.2)`,borderRadius:12,padding:16}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:8}}>📅 {result.date}</div>
        {result.hours>0&&<><Row label="Введено годин" value={`${fmtH(result.hours)} год`} color={C.dim}/>
        <Row label={`Після обіду (-${lb} год)`} value={`${fmtH(result.actualH)} год`} color={C.accent}/></>}
        {result.packs>0&&<Row label="Пачок" value={`${result.packs} шт`} color={C.gold}/>}
        <Row label="Зароблено" value={`${fmt(result.earned)} грн`} color={C.green} bold last/>
      </div>
      <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.accent,textAlign:'center'}}>{motiv}</div>
    </div>
  </Sheet>

  return <Sheet onClose={onClose} title="⏱ Внести зміну">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isOwner&&<div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.filter(w=>w.type==='shift').map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>}
      <div><Lbl>ТИП</Lbl>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          {[['hours','⏱ Години'],['packs','📦 Пачки'],['mixed','⏱📦 Змішана']].map(([k,l])=>
            <button key={k} type="button" onClick={()=>setType(k)} style={{padding:'10px 4px',borderRadius:8,border:`1px solid ${type===k?C.accent:C.border}`,background:type===k?'rgba(56,189,248,0.1)':'transparent',color:type===k?C.accent:C.dim,cursor:'pointer',fontSize:11,fontFamily:'inherit',fontWeight:type===k?700:400}}>{l}</button>
          )}
        </div></div>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      {type!=='packs'&&<div><Lbl>ГОДИНИ (обід -{lb} год буде відраховано)</Lbl>
        <input type="number" inputMode="decimal" step="0.5" min="0" max="24" value={hours} onChange={e=>setHours(e.target.value)} placeholder="напр. 10" style={inp}/>
        {hours&&<div style={{fontSize:11,color:C.accent,marginTop:4}}>= {fmtH(actualH)} год після обіду = {fmt(actualH*(sel?.rateHour||0))} грн</div>}
      </div>}
      {type!=='hours'&&<div><Lbl>ПАЧКИ</Lbl>
        <input type="number" inputMode="numeric" min="0" value={packs} onChange={e=>setPacks(e.target.value)} placeholder="напр. 12" style={inp}/>
        {packs&&(sel?.ratePack||0)>0&&<div style={{fontSize:11,color:C.gold,marginTop:4}}>= {fmt(parseFloat(packs)*(sel?.ratePack||0))} грн</div>}
      </div>}
      {earn>0&&<div style={{background:'rgba(34,197,94,0.08)',border:`1px solid rgba(34,197,94,0.2)`,borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>За зміну</span>
        <span style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(earn)} грн</span>
      </div>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading} style={{background:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:loading?.7:1}}>
        {loading?'Збереження...':'Зберегти зміну'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА АВАНСУ
// ================================================================
function AdvanceForm({worker,allWorkers,isOwner,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId||tgId)
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = isOwner ? (allWorkers.find(w=>w.tgId===Number(selId))||worker) : worker

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveAdvance({tgId:sel.tgId,name:sel.name,date,amount:parseFloat(amount)})
      await writeLog({tgId:isOwner?tgId:sel.tgId,name:sel.name,action:'Аванс',details:`${fmt(amount)} грн`})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="💵 Аванс">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isOwner&&<div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>}
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div><Lbl>СУМА (грн)</Lbl>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[500,1000,2000,3000].map(a=><button key={a} type="button" onClick={()=>{vibrate('light');setAmount(String(a))}} style={{flex:1,padding:'8px 0',borderRadius:8,border:`1px solid ${amount===String(a)?C.gold:C.border}`,background:amount===String(a)?'rgba(245,158,11,0.15)':'transparent',color:amount===String(a)?C.gold:C.dim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{a}</button>)}
        </div>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="або введи вручну" style={inp}/>
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.gold,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Видати аванс'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ПРЕМІЇ (кнопки плюсуються!)
// ================================================================
function BonusForm({worker,allWorkers,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId)
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState(0)
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = allWorkers.find(w=>w.tgId===Number(selId))||worker

  // Кнопки ПЛЮСУЮТЬ суму
  const addAmount = (a) => { vibrate('light'); setAmount(prev => (Number(prev)||0) + a) }

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await saveBonusRecord({tgId:sel.tgId,name:sel.name,date,amount:Number(amount),reason})
      await writeLog({tgId,name:tgName,action:`Премія: ${sel.name}`,details:`${fmt(amount)} грн`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="🏆 Нарахувати премію">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
          <Lbl>СУМА (натискай — плюсується!)</Lbl>
          {amount>0&&<button type="button" onClick={()=>setAmount(0)} style={{background:'transparent',border:'none',color:C.red,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Скинути</button>}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          {[200,300,500,1000].map(a=><button key={a} type="button" onClick={()=>addAmount(a)} style={{flex:1,padding:'8px 0',borderRadius:8,border:`1px solid ${C.gold}`,background:'rgba(245,158,11,0.1)',color:C.gold,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>+{a}</button>)}
        </div>
        <input type="number" inputMode="numeric" value={amount||''} onChange={e=>setAmount(e.target.value)} placeholder="або введи вручну" style={inp}/>
      </div>
      {amount>0&&<div style={{background:'rgba(245,158,11,0.08)',border:`1px solid rgba(245,158,11,0.2)`,borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.dim}}>{sel?.name}</span>
        <span style={{fontSize:18,fontWeight:700,color:C.gold}}>+{fmt(Number(amount))} грн</span>
      </div>}
      <div><Lbl>ПРИЧИНА</Lbl><input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="За перевиконання плану" style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success||!amount} style={{background:success?C.green:C.gold,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:!amount?.5:1}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Нарахувати'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ВИПЛАТИ БОРГУ
// ================================================================
function DebtPaymentForm({worker,onClose,onSaved,tgId,tgName}) {
  const [date,    setDate]    = useState(todayStr())
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!amount||!worker.debtPageId) return
    try {
      setLoading(true); setError(null)
      const newR = await saveDebtPayment({
        tgId:worker.tgId,name:worker.name,date,amount:parseFloat(amount),
        debtPageId:worker.debtPageId,currentRemaining:worker.debtRemaining,
      })
      await writeLog({tgId,name:tgName,action:`Виплата боргу: ${worker.name}`,details:`${fmt(amount)} грн, залишок: ${fmt(newR)} грн`})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`💸 Виплата боргу — ${worker.name}`}>
    <div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,padding:'10px 14px',fontSize:13,color:C.red,marginBottom:14}}>
      Залишок боргу: <b>{fmt(worker.debtRemaining)} грн</b>
    </div>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      <div><Lbl>СУМА ВИПЛАТИ (грн)</Lbl>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`макс. ${fmt(worker.debtRemaining)} грн`} style={inp}/>
        {amount>0&&<div style={{fontSize:11,color:C.green,marginTop:4}}>Залишок після: {fmt(Math.max(0,worker.debtRemaining-parseFloat(amount)))} грн</div>}
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Внести виплату'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА БОРГУ
// ================================================================
function AddDebtForm({worker,allWorkers,onClose,onSaved,tgId,tgName}) {
  const [selId,   setSelId]   = useState(worker?.tgId)
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const sel = allWorkers.find(w=>w.tgId===Number(selId))||worker

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    try {
      setLoading(true); setError(null)
      await addDebt({tgId:sel.tgId,name:sel.name,amount:parseFloat(amount)})
      await writeLog({tgId,name:tgName,action:`Борг: ${sel.name}`,details:`${fmt(amount)} грн`})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="⚠️ Додати борг">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>РОБІТНИК</Lbl>
        <select value={selId} onChange={e=>setSelId(e.target.value)} style={{...inp,cursor:'pointer'}}>
          {allWorkers.map(w=><option key={w.tgId} value={w.tgId}>{w.name}</option>)}
        </select></div>
      <div><Lbl>СУМА БОРГУ (грн)</Lbl>
        <input type="number" inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="напр. 2000" style={inp}/>
        {sel?.debtRemaining>0&&<div style={{fontSize:11,color:C.red,marginTop:4}}>Поточний борг: {fmt(sel.debtRemaining)} грн → буде: {fmt((sel.debtRemaining||0)+(parseFloat(amount)||0))} грн</div>}
      </div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.red,color:'#fff',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Додати борг'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА СТАВОК
// ================================================================
function Toggle({on,onClick,label,color}) {
  return <div onClick={onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer'}}>
    <span style={{fontSize:13,color:C.text}}>{label}</span>
    <div style={{width:46,height:26,borderRadius:13,background:on?(color||C.green):'rgba(255,255,255,0.12)',position:'relative',transition:'background .2s',flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:on?23:3,transition:'left .2s'}}/>
    </div>
  </div>
}

function RatesForm({worker,onClose,onSaved,tgId,tgName}) {
  const isFixed = worker.type==='fixed'
  const [val,        setVal]        = useState(isFixed?(worker.gross||''):(worker.rateHour||''))
  const [valPack,    setValPack]    = useState(worker.ratePack||'')
  const [bonusOff,   setBonusOff]   = useState(worker.bonusOff||false)
  const [premiumOff, setPremiumOff] = useState(worker.premiumOff||false)
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState(null)

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      if (isFixed) await updateFixedSalary(worker.staffPageId, val)
      else {
        await updateStaffRates(worker.staffPageId, {rateHour:val!==''?val:undefined,ratePack:valPack!==''?valPack:undefined})
        await updateStaffToggles(worker.staffPageId, {bonusOff,premiumOff})
      }
      await writeLog({tgId,name:tgName,action:`Ставки: ${worker.name}`,details:isFixed?`Фікс: ${val}`:`Год: ${val}, Пач: ${valPack}, Бонуси:${bonusOff?'OFF':'ON'}, Премії:${premiumOff?'OFF':'ON'}`})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`✏️ Ставки — ${worker.name}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      {isFixed
        ? <div><Lbl>ФІКСОВАНА ЗАРПЛАТА (грн/міс)</Lbl><input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder={`Зараз: ${worker.gross||'—'}`} style={inp}/></div>
        : <>
          <div><Lbl>СТАВКА ЗА ГОДИНУ (грн)</Lbl><input type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder={`Зараз: ${worker.rateHour||'—'}`} style={inp}/></div>
          <div><Lbl>СТАВКА ЗА ПАЧКУ (грн)</Lbl><input type="number" value={valPack} onChange={e=>setValPack(e.target.value)} placeholder={`Зараз: ${worker.ratePack||'—'}`} style={inp}/></div>
          <div>
            <Lbl>НАРАХУВАННЯ ВИПЛАТ</Lbl>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <Toggle on={!bonusOff}   onClick={()=>{vibrate('light');setBonusOff(v=>!v)}}     label="⭐ Бонуси (10+ год, суботи)" color={C.gold}/>
              <Toggle on={!premiumOff} onClick={()=>{vibrate('light');setPremiumOff(v=>!v)}}   label="🏆 Премія за місяць" color={C.purple}/>
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:6}}>Вимкнено — не нараховується навіть якщо умови виконані</div>
          </div>
        </>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Зберегти'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА РЕДАГУВАННЯ ПРАЦІВНИКА
// ================================================================
function EditWorkerForm({worker,onClose,onSaved,tgId,tgName}) {
  const [name,    setName]    = useState(worker.name||'')
  const [newTgId, setNewTgId] = useState(worker.tgId||'')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const [confirm, setConfirm] = useState(false)

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      await updateStaffInfo(worker.staffPageId, {name,tgId:newTgId})
      await writeLog({tgId,name:tgName,action:`Редагування: ${worker.name}`,details:`Нове: ${name}`})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  async function handleDelete() {
    if (!confirm) { vibrate('warning'); setConfirm(true); return }
    try {
      setLoading(true)
      await deleteStaff(worker.staffPageId)
      await writeLog({tgId,name:tgName,action:`Видалення: ${worker.name}`,details:''})
      onSaved(); onClose()
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title={`✏️ Редагувати — ${worker.name}`}>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ПІБ</Lbl><input type="text" value={name} onChange={e=>setName(e.target.value)} style={inp}/></div>
      <div><Lbl>TELEGRAM ID</Lbl><input type="number" value={newTgId} onChange={e=>setNewTgId(e.target.value)} style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Зберегти'}
      </button>
      <button type="button" onClick={handleDelete} style={{background:confirm?C.red:'transparent',color:confirm?'#fff':C.red,border:`1px solid ${C.red}`,borderRadius:10,padding:12,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
        {confirm?'⚠️ Підтвердити видалення':'🗑 Видалити працівника'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА ДОДАВАННЯ ПРАЦІВНИКА
// ================================================================
function AddWorkerForm({onClose,onSaved,tgId,tgName}) {
  const [type,    setType]    = useState('shift')
  const [name,    setName]    = useState('')
  const [newTgId, setNewTgId] = useState('')
  const [rateH,   setRateH]   = useState('')
  const [rateP,   setRateP]   = useState('')
  const [salary,  setSalary]  = useState('')
  const [role,    setRole]    = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name||!newTgId) return
    try {
      setLoading(true); setError(null)
      if (type==='shift') await addStaff({tgId:Number(newTgId),name,rateHour:parseFloat(rateH)||0,ratePack:parseFloat(rateP)||0})
      else await addFixedStaff({tgId:Number(newTgId),name,salary:parseFloat(salary)||0,role})
      await writeLog({tgId,name:tgName,action:`Додано: ${name}`,details:`ID: ${newTgId}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1400)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="➕ Додати працівника">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <div><Lbl>ТИП</Lbl>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[['shift','⏱ Погодинний'],['fixed','💰 Фіксована']].map(([k,l])=>
            <button key={k} type="button" onClick={()=>setType(k)} style={{padding:'10px',borderRadius:8,border:`1px solid ${type===k?C.accent:C.border}`,background:type===k?'rgba(56,189,248,0.1)':'transparent',color:type===k?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:type===k?700:400}}>{l}</button>
          )}
        </div></div>
      <div><Lbl>ПІБ</Lbl><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Іван Петренко" style={inp}/></div>
      <div><Lbl>TELEGRAM ID</Lbl>
        <input type="number" value={newTgId} onChange={e=>setNewTgId(e.target.value)} placeholder="123456789" style={inp}/>
        <div style={{fontSize:10,color:C.muted,marginTop:4}}>Дізнатись у @userinfobot</div>
      </div>
      {type==='shift'&&<>
        <div><Lbl>СТАВКА/ГОД (грн)</Lbl><input type="number" value={rateH} onChange={e=>setRateH(e.target.value)} placeholder="85" style={inp}/></div>
        <div><Lbl>СТАВКА/ПАЧКУ (грн)</Lbl><input type="number" value={rateP} onChange={e=>setRateP(e.target.value)} placeholder="140" style={inp}/></div>
      </>}
      {type==='fixed'&&<>
        <div><Lbl>ЗАРПЛАТА/МІС (грн)</Lbl><input type="number" value={salary} onChange={e=>setSalary(e.target.value)} placeholder="15000" style={inp}/></div>
        <div><Lbl>ПОСАДА</Lbl><input type="text" value={role} onChange={e=>setRole(e.target.value)} placeholder="Бухгалтер" style={inp}/></div>
      </>}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.green,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Додано!':'Додати працівника'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// ФОРМА НАЛАШТУВАНЬ
// ================================================================
function SettingsForm({cfg,onClose,onSaved,tgId,tgName}) {
  const [form,    setForm]    = useState({...cfg})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:Number(v)}))

  async function submit(e) {
    e.preventDefault()
    try {
      setLoading(true); setError(null)
      await saveSettings(cfg.pageId, form)
      await writeLog({tgId,name:tgName,action:'Налаштування',details:JSON.stringify(form)})
      vibrate('medium')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1200)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  const fields = [
    {k:'minDaysForBonus', l:'Мін. днів для бонусів'},
    {k:'longDayHours',    l:'Годин для "довгого дня"'},
    {k:'longDaysNeeded',  l:'Потрібно довгих днів'},
    {k:'bonusPerLongDay', l:'Бонус за довгий день (грн)'},
    {k:'bonusSaturday',   l:'Бонус за суботу (грн)'},
    {k:'premiumDays',     l:'Днів для премії'},
    {k:'premiumAmount',   l:'Сума премії (грн)'},
    {k:'lunchBreak',      l:'Обід (год)'},
  ]

  return <Sheet onClose={onClose} title="⚙️ Налаштування">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:12}}>
      {fields.map(f=><div key={f.k}><Lbl>{f.l}</Lbl><input type="number" step="0.5" value={form[f.k]??''} onChange={e=>set(f.k,e.target.value)} style={inp}/></div>)}
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.purple,color:'#fff',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Зберегти'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// РОЗДІЛ БОРГІВ (для власника)
// ================================================================
function DebtsView({workers,onBack,onRefresh,tgId,tgName}) {
  const [modal,  setModal]  = useState(null)
  const [selW,   setSelW]   = useState(null)
  const debtors = workers.filter(w=>w.debtRemaining>0)
  const totalDebt = debtors.reduce((s,w)=>s+w.debtRemaining,0)

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="💸 Борги" onBack={onBack}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <Card top={C.red}>
        <Lbl>Загальний борг</Lbl>
        <div style={{fontSize:22,fontWeight:700,color:C.red}}>{fmt(totalDebt)} грн</div>
        <div style={{fontSize:11,color:C.muted,marginTop:4}}>{debtors.length} боржників</div>
      </Card>

      {debtors.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>🎉 Боргів немає!</div>}

      {debtors.map((w,i)=>(
        <Card key={w.tgId}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <span style={{color:C.w[i%C.w.length],fontWeight:600,fontSize:14}}>{w.name}</span>
            <span style={{color:C.red,fontWeight:700,fontSize:14}}>{fmt(w.debtRemaining)} грн</span>
          </div>
          <Prog val={w.debtRemaining} max={w.debtRemaining+(w.debtPaid||0)} color={C.red}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:C.muted}}>
            <span>Погашено: {fmt(w.debtPaid||0)} грн</span>
            <span>{w.debtPaid>0?`${Math.round(w.debtPaid/(w.debtRemaining+w.debtPaid)*100)}%`:'0%'} погашено</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>
            <button onClick={()=>{setSelW(w);setModal('debtpay')}} style={{background:`${C.red}11`,border:`1px solid ${C.red}`,color:C.red,borderRadius:8,padding:'8px',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>💸 Виплата</button>
            <button onClick={()=>{setSelW(w);setModal('adddebt')}} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:'8px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>➕ Додати борг</button>
          </div>
        </Card>
      ))}

      <button onClick={()=>{setSelW(workers[0]);setModal('adddebt')}} style={{background:'rgba(241,71,71,0.1)',border:`1px solid ${C.red}`,color:C.red,borderRadius:10,padding:12,fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
        ➕ Новий борг
      </button>
    </div>

    {modal==='debtpay'&&selW&&<DebtPaymentForm worker={selW} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='adddebt'&&<AddDebtForm worker={selW||workers[0]} allWorkers={workers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// ПОЛЕ З ВИБОРОМ + ДОДАВАННЯ (для відправок)
// ================================================================
function SelectWithAdd({label,value,onChange,options,onAddNew,placeholder}) {
  const [adding, setAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newVal.trim()) return
    try {
      setSaving(true)
      await onAddNew(newVal.trim())
      onChange(newVal.trim())
      vibrate('light')
      setNewVal(''); setAdding(false)
    } catch(e) { alert('Помилка: '+e.message) }
    finally { setSaving(false) }
  }

  return <div>
    <Lbl>{label}</Lbl>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{...inp,cursor:'pointer'}}>
      <option value="">{placeholder||'— оберіть —'}</option>
      {options.map(o=><option key={o.id||o.name} value={o.name}>{o.name}</option>)}
    </select>
    {!adding
      ? <button type="button" onClick={()=>setAdding(true)} style={{marginTop:6,background:'transparent',border:'none',color:C.accent,fontSize:12,cursor:'pointer',fontFamily:'inherit',padding:'2px 0'}}>+ Додати новий</button>
      : <div style={{marginTop:8,display:'flex',gap:6}}>
          <input value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Введи нове значення" style={{...inp,fontSize:13}} autoFocus/>
          <button type="button" onClick={handleAdd} disabled={saving} style={{background:C.green,border:'none',color:'#000',borderRadius:8,padding:'0 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>{saving?'...':'✓'}</button>
          <button type="button" onClick={()=>{setAdding(false);setNewVal('')}} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:8,padding:'0 12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',flexShrink:0}}>✕</button>
        </div>}
  </div>
}

// ================================================================
// ФОРМА ВІДПРАВКИ
// ================================================================
function ShipmentForm({refs,onClose,onSaved,onRefsChanged,tgId,tgName}) {
  const [firm,     setFirm]     = useState('')
  const [material, setMaterial] = useState('')
  const [size,     setSize]     = useState('')
  const [qty,      setQty]      = useState('')
  const [date,     setDate]     = useState(todayStr())
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!firm||!material||!qty) { setError('Заповни фірму, вид і кількість'); return }
    try {
      setLoading(true); setError(null)
      await saveShipment({ firm, material, size, qty, date })
      await writeLog({tgId,name:tgName,action:'Відправка',details:`${firm}: ${material} ${size} ×${qty}`})
      vibrate('success')
      setSuccess(true)
      setTimeout(()=>{onSaved();onClose()},1300)
    } catch(e){setError(e.message)} finally{setLoading(false)}
  }

  return <Sheet onClose={onClose} title="📦 Нова відправка">
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
      <SelectWithAdd label="ФІРМА" value={firm} onChange={setFirm} options={refs.firms}
        onAddNew={async v=>{await addFirm(v);await onRefsChanged()}} placeholder="— оберіть фірму —"/>
      <SelectWithAdd label="ВИД СИРОВИНИ" value={material} onChange={setMaterial} options={refs.materials}
        onAddNew={async v=>{await addMaterial(v);await onRefsChanged()}} placeholder="— оберіть вид —"/>
      <SelectWithAdd label="РОЗМІР" value={size} onChange={setSize} options={refs.sizes}
        onAddNew={async v=>{await addSize(v);await onRefsChanged()}} placeholder="— оберіть розмір —"/>
      <div><Lbl>КІЛЬКІСТЬ</Lbl>
        <input type="number" inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value)} placeholder="напр. 15" style={inp}/>
      </div>
      <div><Lbl>ДАТА</Lbl><input type="date" value={date} max={todayStr()} onChange={e=>setDate(e.target.value)} style={inp}/></div>
      {error&&<div style={{color:C.red,fontSize:12,padding:'8px 12px',background:`${C.red}11`,borderRadius:8}}>⚠ {error}</div>}
      <button type="submit" disabled={loading||success} style={{background:success?C.green:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        {loading?'Збереження...':success?'✓ Збережено!':'Зберегти відправку'}
      </button>
    </form>
  </Sheet>
}

// ================================================================
// РОЗДІЛ ВІДПРАВОК
// ================================================================
function ShipmentsView({onBack,tgId,tgName,year,month,onMonthChange}) {
  const [refs,      setRefs]      = useState({firms:[],materials:[],sizes:[]})
  const [shipments, setShipments] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [tab,       setTab]       = useState('stats') // stats | list

  const loadRefs = useCallback(async()=>{
    try { setRefs(await fetchShipmentRefs()) } catch(e){}
  },[])

  const loadShipments = useCallback(async(y,m)=>{
    try {
      setLoading(true)
      setShipments(await fetchShipments(y??year, m??month))
    } catch(e){} finally{ setLoading(false) }
  },[year,month])

  useEffect(()=>{ loadRefs(); loadShipments() },[])

  const stats = calcShipmentStats(shipments)
  const totalAll = shipments.reduce((s,sh)=>s+sh.qty,0)

  async function handleDelete(id) {
    if (!confirm('Видалити цю відправку?')) return
    try { await deleteShipment(id); vibrate('medium'); loadShipments() } catch(e){alert(e.message)}
  }

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="📦 Відправки" sub={`${MONTHS_UA[month]} ${year}`} onBack={onBack}
      onRefresh={()=>{loadRefs();loadShipments()}}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={(y,m)=>{onMonthChange(y,m);loadShipments(y,m)}}/>

      <button onClick={()=>setModal(true)} style={{background:C.accent,color:'#000',border:'none',borderRadius:10,padding:14,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        ➕ Нова відправка
      </button>

      {/* Tabs */}
      <div style={{display:'flex',gap:8}}>
        {[['stats','📊 Статистика'],['list','📋 Всі відправки']].map(([k,l])=>
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:'10px',borderRadius:8,border:`1px solid ${tab===k?C.accent:C.border}`,background:tab===k?'rgba(56,189,248,0.1)':'transparent',color:tab===k?C.accent:C.dim,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:tab===k?700:400}}>{l}</button>
        )}
      </div>

      {loading&&<div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Завантаження...</div>}

      {!loading&&tab==='stats'&&<>
        <Card top={C.accent}>
          <Lbl>Всього відправлено за місяць</Lbl>
          <div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(totalAll)} шт</div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>{shipments.length} відправок</div>
        </Card>

        {Object.keys(stats).length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає відправок цього місяця</div>}

        {Object.entries(stats).map(([material,data])=>(
          <Card key={material}>
            <SecTitle right={<span style={{fontSize:12,color:C.accent,fontWeight:700}}>{fmt(data.total)} шт</span>}>{material}</SecTitle>
            {Object.entries(data.sizes).sort((a,b)=>b[1]-a[1]).map(([sz,q])=>(
              <Row key={sz} label={sz} value={`${fmt(q)} шт`} color={C.text}/>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,fontSize:13}}>
              <span style={{color:C.muted}}>Всього</span>
              <span style={{color:C.accent,fontWeight:700}}>{fmt(data.total)} шт</span>
            </div>
          </Card>
        ))}
      </>}

      {!loading&&tab==='list'&&<>
        {shipments.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:14,padding:32}}>Ще немає відправок цього місяця</div>}
        {shipments.map(sh=>(
          <Card key={sh.id}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <span style={{color:C.accent,fontWeight:600,fontSize:14}}>{sh.firm}</span>
              <span style={{fontSize:11,color:C.muted}}>{sh.date}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:13,color:C.dim}}>
                {sh.material}{sh.size?` · ${sh.size}`:''}
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{color:C.gold,fontWeight:700,fontSize:14}}>{fmt(sh.qty)} шт</span>
                <button onClick={()=>handleDelete(sh.id)} style={{background:'transparent',border:`1px solid ${C.red}33`,color:C.red,borderRadius:6,padding:'3px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>🗑</button>
              </div>
            </div>
          </Card>
        ))}
      </>}
    </div>

    {modal&&<ShipmentForm refs={refs} onClose={()=>setModal(false)}
      onSaved={()=>{loadShipments()}}
      onRefsChanged={loadRefs}
      tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// СТАТИСТИКА ПО МІСЯЦЯХ
// ================================================================
function MonthlyStats({tgId,name,onBack}) {
  const [stats,   setStats]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    fetchMonthlyStats(tgId,6).then(s=>{setStats(s);setLoading(false)}).catch(()=>setLoading(false))
  },[tgId])

  if (loading) return <Spinner/>

  const maxEarned = Math.max(...stats.map(s=>s.earned),1)

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="📊 Статистика" sub={name} onBack={onBack}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <Card>
        <SecTitle>ЗАРОБІТОК ПО МІСЯЦЯХ</SecTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stats} margin={{left:-24}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
            <XAxis dataKey="month" stroke={C.muted} fontSize={10}/>
            <YAxis stroke={C.muted} fontSize={9} tickFormatter={v=>`${v/1000}к`}/>
            <Tooltip formatter={v=>`${fmt(v)} грн`} contentStyle={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
            <Bar dataKey="earned" name="Заробіток" fill={C.accent} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SecTitle>ГОДИНИ ПО МІСЯЦЯХ</SecTitle>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={stats} margin={{left:-24}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
            <XAxis dataKey="month" stroke={C.muted} fontSize={10}/>
            <YAxis stroke={C.muted} fontSize={9}/>
            <Tooltip formatter={v=>`${v} год`} contentStyle={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
            <Line type="monotone" dataKey="hours" name="Годин" stroke={C.gold} strokeWidth={2} dot={{fill:C.gold,r:3}}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SecTitle>ДЕТАЛІ</SecTitle>
        {stats.slice().reverse().map((s,i)=>(
          <div key={i} style={{marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:13}}>
              <span style={{color:C.dim}}>{s.month}</span>
              <span style={{color:C.accent,fontWeight:600}}>{fmt(s.earned)} грн</span>
            </div>
            <Prog val={s.earned} max={maxEarned} color={C.accent}/>
            <div style={{display:'flex',gap:12,marginTop:3,fontSize:10,color:C.muted}}>
              <span>⏱ {fmtH(s.hours)} год</span>
              <span>📦 {s.packs} пачок</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  </div>
}

// ================================================================
// ДЕТАЛІ РОБІТНИКА
// ================================================================
function WorkerDetail({w,allWorkers,onBack,onRefresh,tgId,tgName,cfg,isOwner,month,year}) {
  const [modal,    setModal]    = useState(null)
  const [editDay,  setEditDay]  = useState(null)
  const [showStats,setShowStats]= useState(false)
  const [payslip,  setPayslip]  = useState(false)
  const [motiv]                 = useState(randomMotiv())

  if (showStats) return <MonthlyStats tgId={w.tgId} name={w.name} onBack={()=>setShowStats(false)}/>

  const hoursChart = (w.days||[]).map(d=>({
    day:d.date.slice(8),
    normal:d.hours<(cfg?.longDayHours||10)?d.hours:0,
    long:d.hours>=(cfg?.longDayHours||10)?d.hours:0,
  }))

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title={w.name} sub={w.type==='fixed'?(w.role||'Фіксована'):'Погодинний + пачки'} onBack={onBack}
      right={isOwner&&<div style={{display:'flex',gap:6}}>
        <button onClick={()=>setModal('edit')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.dim,borderRadius:6,padding:'4px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>
        <button onClick={()=>setModal('rates')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.accent,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Ставки</button>
      </div>}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Card top={C.accent}><Lbl>До виплати</Lbl><div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</div></Card>
        <Card top={C.green}><Lbl>Нараховано</Lbl><div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(w.gross)} ₴</div></Card>
      </div>

      {w.daysSinceEntry>=2&&w.type==='shift'&&<div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.red}}>
        ⚠ Не вносив дані {w.daysSinceEntry} дні(в)
      </div>}

      {/* Мотивація */}
      {!isOwner&&<div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.accent,textAlign:'center'}}>{motiv}</div>}

      {/* Кнопки */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {w.type==='shift'&&<button onClick={()=>setModal('shift')} style={{background:'rgba(56,189,248,0.1)',border:`1px solid ${C.accent}`,color:C.accent,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>⏱ Зміна</button>}
        {isOwner&&<button onClick={()=>setModal('bonus')} style={{background:'rgba(245,158,11,0.1)',border:`1px solid ${C.gold}`,color:C.gold,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>🏆 Премія</button>}
        <button onClick={()=>setModal('advance')} style={{background:'rgba(245,158,11,0.1)',border:`1px solid ${C.gold}`,color:C.gold,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>💵 Аванс</button>
        {isOwner&&<button onClick={()=>setModal('debt')} style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>⚠️ Борг</button>}
        {w.debtRemaining>0&&<button onClick={()=>setModal('debtpay')} style={{background:`${C.red}11`,border:`1px solid ${C.red}`,color:C.red,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>💸 Виплата боргу</button>}
        <button onClick={()=>setShowStats(true)} style={{background:'rgba(167,139,250,0.1)',border:`1px solid ${C.purple}`,color:C.purple,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>📊 Статистика</button>
        <button onClick={()=>setPayslip(true)} style={{background:'rgba(34,197,94,0.1)',border:`1px solid ${C.green}`,color:C.green,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>📄 Листок</button>
      </div>

      {w.type==='shift'&&<>
        {hoursChart.length>0&&<Card>
          <SecTitle>ГОДИНИ ПО ДНЯХ ⭐=10+</SecTitle>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={hoursChart} barSize={12} margin={{left:-24}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
              <XAxis dataKey="day" stroke={C.muted} fontSize={9}/>
              <YAxis stroke={C.muted} fontSize={9} domain={[0,14]}/>
              <Tooltip formatter={v=>`${v} год`} contentStyle={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
              <Bar dataKey="normal" name="Год." stackId="a" fill={C.accent}/>
              <Bar dataKey="long" name="10+" stackId="a" fill={C.gold} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>}

        <Card>
          <SecTitle>ПРОГРЕС</SecTitle>
          {[
            {l:'Робочі дні', val:w.workDays, max:cfg?.premiumDays||21, c:C.accent, s:`${w.workDays}/${cfg?.premiumDays||21}`},
            {l:'Довгих днів', val:w.longDays, max:cfg?.longDaysNeeded||10, c:C.gold, s:`${w.longDays}/${cfg?.longDaysNeeded||10}`},
            {l:'Суботи', val:w.saturdays, max:4, c:C.purple, s:`${w.saturdays} шт`},
          ].map(p=><div key={p.l} style={{marginBottom:11}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
              <span style={{color:C.dim}}>{p.l}</span><span style={{color:p.c,fontWeight:600}}>{p.s}</span>
            </div>
            <Prog val={p.val} max={p.max} color={p.c}/>
          </div>)}
          <div style={{marginTop:6,fontSize:12,display:'flex',flexDirection:'column',gap:5}}>
            {!w.bonusActive?<span style={{color:C.gold}}>⏳ До бонусів: ще {w.daysToBonus} дні</span>:<span style={{color:C.green}}>✅ Бонуси активні!</span>}
            {w.bonusActive&&w.longToBonus>0?<span style={{color:C.gold}}>⭐ До бонусу: ще {w.longToBonus} днів</span>:w.bonusActive?<span style={{color:C.green}}>⭐ Бонус: +{fmt(w.bonusLong)} грн</span>:null}
            {w.daysToPremium>0?<span style={{color:C.purple}}>🏆 До премії: ще {w.daysToPremium} дні</span>:<span style={{color:C.green}}>🏆 Премія: +{fmt(w.premium)} грн</span>}
          </div>
        </Card>
      </>}

      <Card>
        <SecTitle>РОЗБИВКА</SecTitle>
        {w.type==='shift'&&<>
          <Row label={`Погодинно (${fmtH(w.totalHours)} × ${fmt(w.rateHour)} грн)`} value={`${fmt(w.earnHours)} грн`}/>
          <Row label={`Пачки (${w.totalPacks} × ${fmt(w.ratePack)} грн)`} value={`${fmt(w.earnPacks)} грн`}/>
          {w.bonusLong>0&&<Row label={`Бонус 10+ год (${w.longDays}×)`} value={`+${fmt(w.bonusLong)} грн`} color={C.gold}/>}
          {w.bonusSat>0&&<Row label={`Бонус суботи (${w.saturdays}×)`} value={`+${fmt(w.bonusSat)} грн`} color={C.gold}/>}
          {w.premium>0&&<Row label="Премія" value={`+${fmt(w.premium)} грн`} color={C.green}/>}
          {w.manualBonus>0&&<Row label="Ручні премії" value={`+${fmt(w.manualBonus)} грн`} color={C.green}/>}
        </>}
        {w.type==='fixed'&&<Row label="Фіксована ставка" value={`${fmt(w.gross)} грн`}/>}
        <Row label="Нараховано" value={`${fmt(w.gross)} грн`} bold/>
        {w.totalAdv>0&&<Row label="Аванси" value={`-${fmt(w.totalAdv)} грн`} color={C.red}/>}
        {w.debtPaid>0&&<Row label="Виплата боргу" value={`-${fmt(w.debtPaid)} грн`} color={C.red}/>}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:12}}>
          <span style={{color:C.muted,fontSize:12}}>ДО ВИПЛАТИ</span>
          <span style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</span>
        </div>
        {w.debtRemaining>0&&<div style={{marginTop:10,padding:'8px 12px',background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,fontSize:12,color:C.red}}>
          ⚠ Залишок боргу: {fmt(w.debtRemaining)} грн
        </div>}
      </Card>

      {w.type==='shift'&&w.days?.length>0&&<Card>
        <SecTitle>ДЕТАЛІ ПО ДНЯХ</SecTitle>
        <DaysExpand days={w.days} rateHour={w.rateHour} ratePack={w.ratePack} longDayHours={cfg?.longDayHours} isOwner={isOwner} onEdit={isOwner?setEditDay:null}/>
      </Card>}

      {w.advances?.length>0&&<Card>
        <SecTitle>АВАНСИ</SecTitle>
        {w.advances.map((a,i)=><Row key={i} label={a.date} value={`${fmt(a.amount)} грн`} color={C.gold} last={i===w.advances.length-1}/>)}
      </Card>}

      {w.bonuses?.length>0&&<Card>
        <SecTitle>ПРЕМІЇ</SecTitle>
        {w.bonuses.map((b,i)=><Row key={i} label={b.date} value={`+${fmt(b.amount)} грн`} color={C.green} sub={b.reason} last={i===w.bonuses.length-1}/>)}
      </Card>}
    </div>

    {modal==='shift'  &&<ShiftForm worker={w} allWorkers={allWorkers} isOwner={isOwner} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {modal==='bonus'  &&<BonusForm worker={w} allWorkers={allWorkers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='advance'&&<AdvanceForm worker={w} allWorkers={allWorkers} isOwner={isOwner} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='debt'   &&<AddDebtForm worker={w} allWorkers={allWorkers} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='debtpay'&&<DebtPaymentForm worker={w} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='rates'  &&<RatesForm worker={w} onClose={()=>setModal(null)} onSaved={()=>{onRefresh();setModal(null)}} tgId={tgId} tgName={tgName}/>}
    {modal==='edit'   &&<EditWorkerForm worker={w} onClose={()=>setModal(null)} onSaved={()=>{onBack();onRefresh()}} tgId={tgId} tgName={tgName}/>}
    {editDay&&<EditDayForm day={editDay} worker={w} onClose={()=>setEditDay(null)} onSaved={()=>{onRefresh();setEditDay(null)}} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {payslip&&<PayslipModal w={w} month={month} year={year} onClose={()=>setPayslip(false)}/>}
  </div>
}

// ================================================================
// OWNER DASHBOARD
// ================================================================
function OwnerDashboard({workers,onRefresh,tgId,tgName,cfg,year,month,onMonthChange}) {
  const [view,   setView]   = useState('main')
  const [detail, setDetail] = useState(null)
  const [modal,  setModal]  = useState(null)
  const [search, setSearch] = useState('')

  const totalFOP   = workers.reduce((s,w)=>s+(w.final||0),0)
  const totalGross = workers.reduce((s,w)=>s+(w.gross||0),0)
  const alertWorkers = workers.filter(w=>w.type==='shift'&&w.daysSinceEntry>=2)
  const filtered = search ? workers.filter(w=>w.name.toLowerCase().includes(search.toLowerCase())) : workers

  const chart = workers.map((w,i)=>({
    name:w.name.split(' ').slice(-1)[0],
    base:(w.earnHours||0)+(w.earnPacks||0)||(w.type==='fixed'?w.gross:0),
    bonus:(w.bonusLong||0)+(w.bonusSat||0)+(w.premium||0)+(w.manualBonus||0),
  }))

  if (view==='debts') return <DebtsView workers={workers} onBack={()=>setView('main')} onRefresh={()=>onRefresh(year,month)} tgId={tgId} tgName={tgName}/>
  if (view==='shipments') return <ShipmentsView onBack={()=>setView('main')} tgId={tgId} tgName={tgName} year={year} month={month} onMonthChange={onMonthChange}/>
  if (detail) return <WorkerDetail w={detail} allWorkers={workers} isOwner onBack={()=>setDetail(null)} onRefresh={()=>{setDetail(null);onRefresh(year,month)}} tgId={tgId} tgName={tgName} cfg={cfg} month={month} year={year}/>

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title="🪵 ПИЛОРАМА" sub={`${MONTHS_UA[month]} ${year}`} onRefresh={()=>onRefresh(year,month)}
      right={<button onClick={()=>setModal('settings')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.purple,borderRadius:8,padding:'6px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>⚙️</button>}/>

    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={onMonthChange}/>

      {alertWorkers.length>0&&<div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.red}}>
        ⚠ Не вносили 2+ дні: {alertWorkers.map(w=>w.name.split(' ')[0]).join(', ')}
      </div>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Card top={C.accent}><Lbl>До виплати</Lbl><div style={{fontSize:20,fontWeight:700,color:C.accent}}>{fmt(totalFOP)} ₴</div></Card>
        <Card top={C.green}><Lbl>Нараховано</Lbl><div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(totalGross)} ₴</div></Card>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
        <button onClick={()=>setModal('shift')} style={{background:'rgba(56,189,248,0.1)',border:`1px solid ${C.accent}`,color:C.accent,borderRadius:10,padding:'10px 4px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>⏱ Зміна</button>
        <button onClick={()=>setModal('bonus')} style={{background:'rgba(245,158,11,0.1)',border:`1px solid ${C.gold}`,color:C.gold,borderRadius:10,padding:'10px 4px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>🏆 Премія</button>
        <button onClick={()=>setView('debts')} style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,color:C.red,borderRadius:10,padding:'10px 4px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>💸 Борги</button>
        <button onClick={()=>setModal('addworker')} style={{background:'rgba(34,197,94,0.1)',border:`1px solid ${C.green}`,color:C.green,borderRadius:10,padding:'10px 4px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>➕ Додати</button>
      </div>

      <button onClick={()=>setView('shipments')} style={{background:'rgba(56,189,248,0.1)',border:`1px solid ${C.accent}`,color:C.accent,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>📦 Облік відправок</button>

      <Card>
        <SecTitle>НАРАХУВАННЯ</SecTitle>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chart} barSize={14} margin={{left:-24}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
            <XAxis dataKey="name" stroke={C.muted} fontSize={10}/>
            <YAxis stroke={C.muted} fontSize={9} tickFormatter={v=>`${v/1000}к`}/>
            <Tooltip content={<TTip/>}/>
            <Bar dataKey="base" name="Ставка" stackId="a" fill={C.accent}/>
            <Bar dataKey="bonus" name="Бонуси" stackId="a" fill={C.gold} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SecTitle>ПЕРСОНАЛ</SecTitle>
        {/* Пошук */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Пошук працівника..." style={{...inp,marginBottom:12,fontSize:13}}/>
        {filtered.map((w,i)=><button key={w.tgId||i} onClick={()=>setDetail(w)} style={{width:'100%',background:'rgba(255,255,255,0.02)',border:`1px solid ${w.daysSinceEntry>=2&&w.type==='shift'?C.red:C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:w.type==='shift'?6:0}}>
            <div>
              <span style={{color:C.w[i%C.w.length],fontWeight:600,fontSize:13}}>{w.name}</span>
              {w.type==='fixed'&&<span style={{marginLeft:8,fontSize:10,color:C.purple,background:`${C.purple}22`,padding:'1px 6px',borderRadius:4}}>{w.role||'фікс.'}</span>}
              {w.daysSinceEntry>=2&&w.type==='shift'&&<span style={{marginLeft:6,fontSize:10,color:C.red}}>⚠</span>}
            </div>
            <span style={{color:C.accent,fontWeight:700,fontSize:13}}>{fmt(w.final)} ₴</span>
          </div>
          {w.type==='shift'&&<>
            <Prog val={w.workDays} max={cfg?.premiumDays||21} color={C.w[i%C.w.length]}/>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:C.muted}}>
              <span>{w.workDays} днів · {fmtH(w.totalHours)} год</span>
              <span>{w.longDays} довгих · {w.totalPacks} пачок</span>
            </div>
          </>}
          {w.debtRemaining>0&&<div style={{marginTop:5,fontSize:10,color:C.red}}>⚠ Борг: {fmt(w.debtRemaining)} грн</div>}
        </button>)}
        {filtered.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:13,padding:16}}>Нікого не знайдено</div>}
      </Card>
    </div>

    {modal==='shift'    &&<ShiftForm worker={workers[0]||{}} allWorkers={workers} isOwner onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={tgName} cfg={cfg}/>}
    {modal==='bonus'    &&<BonusForm worker={workers[0]||{}} allWorkers={workers} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={tgName}/>}
    {modal==='addworker'&&<AddWorkerForm onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={tgName}/>}
    {modal==='settings' &&<SettingsForm cfg={cfg} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={tgName}/>}
  </div>
}

// ================================================================
// WORKER VIEW
// ================================================================
function WorkerView({tgId,data,onRefresh}) {
  const w = calcSalary(tgId, data)
  const cfg = data.cfg
  const [modal,      setModal]      = useState(null)
  const [year,       setYear]       = useState(new Date().getFullYear())
  const [month,      setMonth]      = useState(new Date().getMonth())
  const [showStats,  setShowStats]  = useState(false)
  const [showPayslip,setShowPayslip]= useState(false)
  const [motiv]                     = useState(randomMotiv())

  if (showStats) return <MonthlyStats tgId={tgId} name={w.name} onBack={()=>setShowStats(false)}/>

  const hoursChart = (w.days||[]).map(d=>({
    day:d.date.slice(8),
    normal:d.hours<(cfg?.longDayHours||10)?d.hours:0,
    long:d.hours>=(cfg?.longDayHours||10)?d.hours:0,
  }))

  return <div style={{minHeight:'100vh',background:C.bg,paddingBottom:40}}>
    <Header title={`🪵 ${w.name||'Мій кабінет'}`} onRefresh={()=>onRefresh(year,month)}/>
    <div style={{padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14}}>
      <MonthPicker year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m);onRefresh(y,m)}}/>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <Card top={C.accent}><Lbl>До виплати</Lbl><div style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</div></Card>
        <Card top={C.green}><Lbl>Нараховано</Lbl><div style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(w.gross)} ₴</div></Card>
      </div>

      {/* Мотивація */}
      <div style={{background:`${C.accent}11`,border:`1px solid ${C.accent}33`,borderRadius:10,padding:'10px 14px',fontSize:12,color:C.accent,textAlign:'center'}}>{motiv}</div>

      <Card>
        <SecTitle>МОЇ СТАВКИ</SecTitle>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div style={{background:'rgba(56,189,248,0.06)',borderRadius:8,padding:'10px 12px'}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>ЗА ГОДИНУ</div>
            <div style={{fontSize:20,fontWeight:700,color:C.accent}}>{w.rateHour||'—'}</div>
            <div style={{fontSize:10,color:C.muted}}>грн</div>
          </div>
          <div style={{background:'rgba(245,158,11,0.06)',borderRadius:8,padding:'10px 12px'}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>ЗА ПАЧКУ</div>
            <div style={{fontSize:20,fontWeight:700,color:C.gold}}>{w.ratePack||'—'}</div>
            <div style={{fontSize:10,color:C.muted}}>грн</div>
          </div>
        </div>
      </Card>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <button onClick={()=>setModal('shift')} style={{background:'rgba(56,189,248,0.1)',border:`1px solid ${C.accent}`,color:C.accent,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>⏱ Внести зміну</button>
        <button onClick={()=>setModal('advance')} style={{background:'rgba(245,158,11,0.1)',border:`1px solid ${C.gold}`,color:C.gold,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>💵 Аванс</button>
        <button onClick={()=>setShowStats(true)} style={{background:'rgba(167,139,250,0.1)',border:`1px solid ${C.purple}`,color:C.purple,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>📊 Статистика</button>
        <button onClick={()=>setShowPayslip(true)} style={{background:'rgba(34,197,94,0.1)',border:`1px solid ${C.green}`,color:C.green,borderRadius:10,padding:'12px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>📄 Листок</button>
      </div>

      {hoursChart.length>0&&<Card>
        <SecTitle>ГОДИНИ ПО ДНЯХ ⭐=10+</SecTitle>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={hoursChart} barSize={12} margin={{left:-24}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border2}/>
            <XAxis dataKey="day" stroke={C.muted} fontSize={9}/>
            <YAxis stroke={C.muted} fontSize={9} domain={[0,14]}/>
            <Tooltip formatter={v=>`${v} год`} contentStyle={{background:'#1a2535',border:`1px solid ${C.border}`,borderRadius:8,fontSize:11}}/>
            <Bar dataKey="normal" name="Год." stackId="a" fill={C.accent}/>
            <Bar dataKey="long" name="10+" stackId="a" fill={C.gold} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>}

      <Card>
        <SecTitle>ПРОГРЕС І БОНУСИ</SecTitle>
        {[
          {l:'Робочі дні', val:w.workDays, max:cfg?.premiumDays||21, c:C.accent, s:`${w.workDays}/${cfg?.premiumDays||21}`},
          {l:'Довгих днів', val:w.longDays, max:cfg?.longDaysNeeded||10, c:C.gold, s:`${w.longDays}/${cfg?.longDaysNeeded||10}`},
          {l:'Суботи', val:w.saturdays, max:4, c:C.purple, s:`${w.saturdays} шт`},
        ].map(p=><div key={p.l} style={{marginBottom:11}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
            <span style={{color:C.dim}}>{p.l}</span><span style={{color:p.c,fontWeight:600}}>{p.s}</span>
          </div>
          <Prog val={p.val} max={p.max} color={p.c}/>
        </div>)}
        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:6,fontSize:12}}>
          {!w.bonusActive?<div style={{color:C.gold,background:`${C.gold}11`,borderRadius:8,padding:'8px 12px'}}>⏳ До бонусів: ще {w.daysToBonus} дні</div>:<div style={{color:C.green,background:`${C.green}11`,borderRadius:8,padding:'8px 12px'}}>✅ Бонуси активні!</div>}
          {w.bonusActive&&w.longToBonus>0?<div style={{color:C.gold,background:`${C.gold}11`,borderRadius:8,padding:'8px 12px'}}>⭐ До бонусу: ще {w.longToBonus} днів по 10+ год</div>:w.bonusActive?<div style={{color:C.green,background:`${C.green}11`,borderRadius:8,padding:'8px 12px'}}>⭐ Бонус: +{fmt(w.bonusLong)} грн ({w.longDays}×{fmt(cfg?.bonusPerLongDay||100)})</div>:null}
          {w.bonusActive&&w.saturdays>0&&<div style={{color:C.purple,background:`${C.purple}11`,borderRadius:8,padding:'8px 12px'}}>📅 Бонус суботи: +{fmt(w.bonusSat)} грн</div>}
          {w.daysToPremium>0?<div style={{color:C.purple,background:`${C.purple}11`,borderRadius:8,padding:'8px 12px'}}>🏆 До премії: ще {w.daysToPremium} дні</div>:<div style={{color:C.green,background:`${C.green}11`,borderRadius:8,padding:'8px 12px'}}>🏆 Премія: +{fmt(w.premium)} грн</div>}
        </div>
      </Card>

      <Card>
        <SecTitle>РОЗБИВКА</SecTitle>
        <Row label={`Погодинно (${fmtH(w.totalHours)} × ${fmt(w.rateHour)} грн)`} value={`${fmt(w.earnHours)} грн`}/>
        <Row label={`Пачки (${w.totalPacks} × ${fmt(w.ratePack)} грн)`} value={`${fmt(w.earnPacks)} грн`}/>
        {w.bonusLong>0&&<Row label="Бонус 10+ год" value={`+${fmt(w.bonusLong)} грн`} color={C.gold}/>}
        {w.bonusSat>0&&<Row label="Бонус суботи" value={`+${fmt(w.bonusSat)} грн`} color={C.gold}/>}
        {w.premium>0&&<Row label="Премія" value={`+${fmt(w.premium)} грн`} color={C.green}/>}
        {w.manualBonus>0&&<Row label="Ручні премії" value={`+${fmt(w.manualBonus)} грн`} color={C.green}/>}
        <Row label="Нараховано" value={`${fmt(w.gross)} грн`} bold/>
        {w.totalAdv>0&&<Row label="Аванси" value={`-${fmt(w.totalAdv)} грн`} color={C.red}/>}
        {w.debtPaid>0&&<Row label="Виплата боргу" value={`-${fmt(w.debtPaid)} грн`} color={C.red}/>}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:12}}>
          <span style={{color:C.muted,fontSize:12}}>ДО ВИПЛАТИ</span>
          <span style={{fontSize:22,fontWeight:700,color:C.accent}}>{fmt(w.final)} ₴</span>
        </div>
        {w.debtRemaining>0&&<div style={{marginTop:10,padding:'10px 14px',background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8}}>
          <div style={{fontSize:12,color:C.red,marginBottom:6}}>⚠ Залишок боргу: {fmt(w.debtRemaining)} грн</div>
          {w.debtPaid>0&&<Prog val={w.debtPaid} max={w.debtRemaining+w.debtPaid} color={C.green}/>}
          {w.debtPaid>0&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>Погашено: {fmt(w.debtPaid)} грн</div>}
        </div>}
      </Card>

      {w.days?.length>0&&<Card>
        <SecTitle>МОЇ ДНІ</SecTitle>
        <DaysExpand days={w.days} rateHour={w.rateHour} ratePack={w.ratePack} longDayHours={cfg?.longDayHours}/>
      </Card>}
    </div>

    {modal==='shift'  &&<ShiftForm worker={w} allWorkers={[w]} isOwner={false} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={w.name} cfg={cfg}/>}
    {modal==='advance'&&<AdvanceForm worker={w} allWorkers={[w]} isOwner={false} onClose={()=>setModal(null)} onSaved={()=>onRefresh(year,month)} tgId={tgId} tgName={w.name}/>}
    {showPayslip&&<PayslipModal w={w} month={month} year={year} onClose={()=>setShowPayslip(false)}/>}
  </div>
}

// ================================================================
// MAIN APP
// ================================================================
export default function App() {
  const [state,   setState]   = useState('loading')
  const [error,   setError]   = useState(null)
  const [data,    setData]    = useState(null)
  const [workers, setWorkers] = useState([])
  const [isOwner, setIsOwner] = useState(false)
  const [tgId,    setTgId]    = useState(null)
  const [tgName,  setTgName]  = useState('')
  const [year,    setYear]    = useState(new Date().getFullYear())
  const [month,   setMonth]   = useState(new Date().getMonth())

  const load = useCallback(async (y, m) => {
    try {
      setState('loading'); setError(null)
      const tg = window.Telegram?.WebApp
      tg?.ready(); tg?.expand()
      tg?.setHeaderColor?.('#0b1017')
      tg?.setBackgroundColor?.('#0b1017')

      const uid   = tg?.initDataUnsafe?.user?.id || null
      const uname = tg?.initDataUnsafe?.user?.first_name || ''
      setTgId(uid); setTgName(uname)

      const owner = OWNER_IDS.includes(uid)
      setIsOwner(owner)

      const yr = y ?? new Date().getFullYear()
      const mo = m ?? new Date().getMonth()
      setYear(yr); setMonth(mo)

      const allData = await fetchAllData(yr, mo)
      setData(allData)

      if (owner) {
        setWorkers(calcAllWorkers(allData))
        setState('owner')
      } else {
        const acc = await checkAccess(uid)
        setState(acc.allowed ? 'worker' : 'denied')
      }
    } catch(e) { setError(e.message); setState('error') }
  }, [])

  useEffect(()=>{ load() },[])

  const handleMonthChange = (y, m) => { setYear(y); setMonth(m); load(y, m) }

  if (state==='loading') return <Spinner/>

  if (state==='error') return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{fontSize:36}}>⚠️</div>
      <div style={{color:C.red,fontSize:14,fontWeight:700}}>Помилка підключення</div>
      <div style={{color:C.dim,fontSize:12,textAlign:'center',maxWidth:300,lineHeight:1.6}}>{error}</div>
      <button onClick={()=>load()} style={{background:C.accent,color:'#000',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>Спробувати знову</button>
    </div>
  )

  if (state==='denied') return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{fontSize:48}}>🔒</div>
      <div style={{color:C.red,fontSize:15,fontWeight:700}}>Доступ закрито</div>
      <div style={{color:C.dim,fontSize:13,textAlign:'center',maxWidth:280,lineHeight:1.7}}>Тебе ще не додано до системи.<br/>Зверніться до власника.</div>
      {tgId&&<div style={{background:'rgba(56,189,248,0.06)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 16px',fontSize:11,color:C.muted,textAlign:'center'}}>
        Твій Telegram ID:<br/><span style={{color:C.accent,fontSize:15,fontWeight:700}}>{tgId}</span><br/>
        <span style={{fontSize:10}}>(надішли власнику)</span>
      </div>}
    </div>
  )

  if (state==='owner')  return <OwnerDashboard workers={workers} onRefresh={load} tgId={tgId} tgName={tgName} cfg={data?.cfg||DEFAULT_CFG} year={year} month={month} onMonthChange={handleMonthChange}/>
  if (state==='worker') return <WorkerView tgId={tgId} data={data} onRefresh={load}/>
  return null
}
