export function weekKey(input=new Date()){
  const d=new Date(input); const day=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-day); d.setUTCHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export function scoreProgram(p,ctx={}){
  const wanted=new Set((ctx.tags||[]).map(x=>String(x).toLowerCase()));
  const tags=(p.tags||[]).map(x=>String(x).toLowerCase());
  let score=Number(p.attributes?.baseValue||0);
  for(const t of tags) if(wanted.has(t)) score+=20;
  for(const s of (ctx.signals||[])) if(tags.includes(String(s.tag||'').toLowerCase())) score+=Math.min(25,Number(s.weight||1)*5);
  if((ctx.recentIds||[]).includes(p.id)) score-=1000;
  return score;
}
export function buildWeek({channel,week,catalog,profile={},signals=[],recentIds=[]}){
  const start=new Date((week||weekKey())+'T00:00:00.000Z');
  const slotMinutes=Math.max(5,Number(profile.slotMinutes||120));
  const slots=Math.ceil(7*24*60/slotMinutes);
  const eligible=catalog.filter(p=>p.sources?.some(s=>s.status==='playable'));
  const ranked=eligible.map(p=>({p,score:scoreProgram(p,{tags:profile.tags,signals,recentIds})}))
    .sort((a,b)=>b.score-a.score || hash(channel+'|'+week+'|'+a.p.id)-hash(channel+'|'+week+'|'+b.p.id));
  const out=[]; const used=new Set();
  for(let i=0;i<slots;i++){
    let row=ranked.find(x=>!used.has(x.p.id)) || ranked[i%Math.max(1,ranked.length)];
    if(!row) break;
    used.add(row.p.id);
    const source=row.p.sources.find(s=>s.status==='playable');
    const scheduledStart=new Date(start.getTime()+i*slotMinutes*60000).toISOString();
    out.push({slot:i,catalogId:row.p.id,title:row.p.title,scheduledStart,runtimeMinutes:row.p.runtimeMinutes,source,selectionScore:row.score,selectionReasons:['channel-fit','eligible-source',...(row.score>0?['weighted-discovery']:[])]});
  }
  return {schema:'infinity-week-schedule-v1',channel,week:week||weekKey(),generatedAt:new Date().toISOString(),slotMinutes,programs:out};
}
