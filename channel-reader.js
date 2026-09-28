(function(g){"use strict";
const API="https://tv-database.marvaseater.workers.dev",REFRESH_MS=60000;
function id(v){return /^[A-Za-z0-9_-]{6,15}$/.test(String(v||""))?String(v):""}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c])}
function stationTime(value,timeZone){return new Intl.DateTimeFormat("en-US",{timeZone:timeZone||"America/Chicago",hour:"numeric",minute:"2-digit"}).format(new Date(value))}
function stationDate(value,timeZone){return new Intl.DateTimeFormat("en-US",{timeZone:timeZone||"America/Chicago",weekday:"long",month:"long",day:"numeric"}).format(new Date(value))}
function poster(program){const source=program&&program.source||{},video=id(source.sourceId);return program&&program.posterUrl||source.thumbnailUrl||(video?"https://i.ytimg.com/vi/"+video+"/hqdefault.jpg":"")}
async function fetchJson(path){const r=await fetch(API+path,{cache:"no-store"});if(!r.ok)throw new Error("schedule_"+r.status);return r.json()}
async function get(channel){const encoded=encodeURIComponent(channel),[nowResult,scheduleResult]=await Promise.all([fetchJson("/v1/now/"+encoded),fetchJson("/v1/schedule/"+encoded)]);if(!nowResult.ok||!nowResult.now||!id(nowResult.now.source&&nowResult.now.source.sourceId))throw new Error("no_remote_program");if(scheduleResult&&scheduleResult.ok&&scheduleResult.schedule)nowResult.schedule=scheduleResult.schedule;return nowResult}
function renderSchedule(payload){
  const schedule=payload&&payload.schedule,programs=schedule&&Array.isArray(schedule.programs)?schedule.programs:[];if(!programs.length)return;
  const zone=schedule.timeZone||"America/Chicago",now=payload.now||{},currentIndex=Math.max(0,programs.findIndex(p=>p.catalogId===now.catalogId&&p.scheduledStart===now.scheduledStart)),today=String(now.scheduledLocal||"").slice(0,10),todays=programs.filter(p=>String(p.scheduledLocal||"").slice(0,10)===today);
  const next=document.getElementById("nextCards");if(next)next.innerHTML=[1,2,3].map(step=>programs[(currentIndex+step)%programs.length]).filter(Boolean).map(p=>{const art=poster(p).replace(/["')]/g,encodeURIComponent);return `<article class="next-card"${art?` style="--card-art:url('${art}')"`:""}><time>${esc(stationTime(p.scheduledStart,zone))}</time><div><h3>${esc(p.title)}</h3><p>${esc(p.type||"movie")} · Cloudflare schedule</p></div></article>`}).join("");
  const guide=document.getElementById("guideRows");if(guide)guide.innerHTML=todays.map(p=>`<article class="guide-row${p.catalogId===now.catalogId&&p.scheduledStart===now.scheduledStart?" current":""}"><time>${esc(stationTime(p.scheduledStart,zone))}</time><strong>${esc(p.title)}</strong><span>${esc(p.type||"movie")} · ${Number(p.slotMinutes||120)} min slot</span></article>`).join("");
  const guideDate=document.getElementById("guideDate");if(guideDate&&now.scheduledStart)guideDate.textContent=stationDate(now.scheduledStart,zone);
}
function managedPlayer(){return Boolean(g.YT||g.onYouTubeIframeAPIReady||document.querySelector('script[src*="iframe_api"]'))}
let timer=0,lastChannel="";
async function refresh(channel){const x=await get(channel),p=x.now,vid=id(p.source.sourceId);g.INFINITY_REMOTE_NOW=x;renderSchedule(x);g.dispatchEvent(new CustomEvent("infinity:schedule-now",{detail:x}));const title=document.getElementById("nowTitle")||document.getElementById("title");if(title)title.textContent=p.title;if(managedPlayer())return x;const host=document.getElementById("player");if(host&&vid){const sec=Math.max(0,Number(x.offsetSeconds||0)),src="https://www.youtube.com/embed/"+vid+"?playsinline=1&controls=1&start="+sec,old=host.querySelector("iframe");if(!old||!old.src.includes("/"+vid+"?")){host.innerHTML="";const f=document.createElement("iframe");f.src=src;f.allow="autoplay; encrypted-media; picture-in-picture";f.allowFullscreen=true;f.title=p.title;host.appendChild(f)}}return x}
async function start(channel){lastChannel=channel;clearInterval(timer);try{return await refresh(channel)}catch(e){console.warn("[Channel Creatir reader] local fallback:",e.message);return null}finally{timer=setInterval(()=>refresh(lastChannel).catch(e=>console.warn("[Channel Creatir reader] refresh deferred:",e.message)),REFRESH_MS)}}
g.InfinityChannelReader={api:API,get,start,refresh};
})(window);
