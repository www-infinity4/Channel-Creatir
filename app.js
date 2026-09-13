(function(){
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('creatorForm');
  const brief = $('brief');
  const channelName = $('channelName');
  const repoName = $('repoName');
  const slotMinutes = $('slotMinutes');
  const channelType = $('channelType');
  const rotation = $('rotation');
  const mediaLines = $('mediaLines');
  const owner = $('owner');
  const githubToken = $('githubToken');
  const deployButton = $('deployButton');
  const buildState = $('buildState');
  const outputTitle = $('outputTitle');
  const summary = $('summary');
  const previewFrame = $('previewFrame');
  const fileList = $('fileList');
  const fileCode = $('fileCode');
  const manifestCode = $('manifestCode');
  const deployLog = $('deployLog');
  let lastBuild = null;

  const sample = 'Building Physics TV. It focuses on physics documentaries, demonstrations and full educational episodes. Use 30 and 60 minute slots. Full content only. Change the full schedule at midnight local time, keep everybody synced, leave intermission space for future advertising, and add it to the shared remote.';

  function slugify(value){
    return String(value||'New-Channel').trim().replace(/&/g,'and').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-') || 'New-Channel';
  }

  function html(value){
    return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function inferName(text){
    const patterns = [
      /(?:building|build|create|making|make)\s+(?:out\s+)?(?:the\s+)?([A-Za-z0-9&' -]{2,45}?)(?:\s+(?:channel|network|station))?(?:[.,\n]|\s+using\b|\s+with\b|\s+that\b|\s+which\b)/i,
      /(?:called|named)\s+([A-Za-z0-9&' -]{2,45})(?:[.,\n]|$)/i,
      /^([A-Za-z0-9&' -]{2,35})(?:\s+is\s+|[.:\n])/i
    ];
    for(const re of patterns){
      const m = text.match(re);
      if(m && m[1]){
        let name = m[1].trim().replace(/\bwe are$/i,'').trim();
        if(!/\b(tv|channel|network|station)\b/i.test(name) && /\btv\b/i.test(text.slice(0,80))) name += ' TV';
        return name.replace(/\s+/g,' ');
      }
    }
    return '';
  }

  function inferSlot(text){
    const hour = text.match(/\b(\d+(?:\.\d+)?)\s*[- ]?hour\b/i);
    if(hour) return Math.max(5,Math.round(Number(hour[1])*60));
    const min = text.match(/\b(\d+)\s*[- ]?minute\b/i);
    if(min) return Math.max(5,Number(min[1]));
    if(/music video|songs?|mtv|vh1/i.test(text)) return 5;
    if(/cartoon|sitcom|episode|nickelodeon/i.test(text)) return 30;
    if(/sports|baseball|football|game\b/i.test(text)) return 180;
    if(/movie|film|cinema|hbo|showtime|starz/i.test(text)) return 120;
    return 60;
  }

  function inferType(text){
    if(/news|cnn|headline|world news/i.test(text)) return 'news';
    if(/music video|song|mtv|vh1|rock|metal|jukebox/i.test(text)) return 'music';
    if(/sports|baseball|football|basketball|fight|boxing|game\b/i.test(text)) return 'sports';
    if(/documentar|history|physics|science|discovery/i.test(text)) return 'documentary';
    if(/shop|merchandise|product|shopping|shoplc/i.test(text)) return 'shopping';
    if(/cartoon|episode|sitcom|series|television show|tv show/i.test(text)) return 'tv';
    if(/movie|film|cinema/i.test(text)) return 'movies';
    return 'mixed';
  }

  function inferRotation(text){
    if(/weekly|week build|new week|every week/i.test(text)) return 'weekly';
    if(/constantly updated|rolling|live news|algorithmically feed|continuous/i.test(text)) return 'rolling';
    return 'daily';
  }

  function extractKeywords(text,name,type){
    const stop = new Set('the and that with from this into then when what your you are for only full channel build building using use every will should have has its our all day daily next live synced sync add remote content shows movies movie episodes episode videos video future local time change new same good great make makes'.split(' '));
    const words = text.toLowerCase().replace(/[^a-z0-9' -]/g,' ').split(/\s+/).filter(w=>w.length>3&&!stop.has(w));
    const unique = [];
    [name,type].concat(words).forEach(w=>{ if(w && !unique.includes(w)) unique.push(w); });
    return unique.slice(0,14);
  }

  function parseMedia(text){
    return String(text||'').split(/\n+/).map((line,index)=>{
      line=line.trim(); if(!line) return null;
      const parts=line.split('|').map(s=>s.trim());
      const urlPart=parts.find(p=>/youtu(?:\.be|be\.com)/i.test(p)) || line;
      const idMatch=urlPart.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);
      const rawId=!idMatch && /^[A-Za-z0-9_-]{8,15}$/.test(urlPart)?urlPart:null;
      const videoId=idMatch?idMatch[1]:rawId;
      const runtime = Number(parts.find(p=>/^\d+(?:\.\d+)?$/.test(p))) || 60;
      const title = parts[0] && !/youtu/i.test(parts[0]) ? parts[0] : 'Program '+(index+1);
      return {id:'program-'+(index+1),title,videoId:videoId||'',runtimeMinutes:Math.max(1,runtime),cleared:!!videoId,sourceUrl:videoId?'https://www.youtube.com/watch?v='+videoId:''};
    }).filter(Boolean);
  }

  function parseBrief(){
    const text=brief.value.trim();
    const inferredName=inferName(text)||channelName.value.trim()||'New Channel';
    if(!channelName.value.trim()) channelName.value=inferredName;
    if(!repoName.value.trim()) repoName.value=slugify(inferredName);
    const slot=inferSlot(text); slotMinutes.value=String([5,15,30,60,120,180].includes(slot)?slot:(slot<45?30:slot<90?60:slot<150?120:180));
    channelType.value=inferType(text);
    rotation.value=inferRotation(text);
  }

  function buildSpec(){
    const text=brief.value.trim();
    const name=channelName.value.trim()||inferName(text)||'New Channel';
    const repo=slugify(repoName.value.trim()||name);
    const type=channelType.value;
    const slot=Number(slotMinutes.value)||60;
    const rot=rotation.value;
    const media=parseMedia(mediaLines.value);
    return {
      schema:'infinity-channel-v1',
      generatedAt:new Date().toISOString(),
      name,
      id:repo.toUpperCase(),
      repo,
      owner:owner.value.trim()||'www-infinity4',
      type,
      slotMinutes:slot,
      rotation:rot,
      brief:text,
      keywords:extractKeywords(text,name,type),
      rules:{
        synced:!/not synced|unsynced/i.test(text),
        midnightRollover:rot==='daily'||/midnight|12:?00\s*am/i.test(text),
        fullContentOnly:!/trailers allowed|clips allowed|preview clips/i.test(text),
        intermission:/intermission|advertis|commercial|unused/i.test(text)||type==='music',
        sharedRemote:!/no remote/i.test(text),
        starCoinShare:true
      },
      media
    };
  }

  function catalogFile(spec){
    const items=spec.media.length?spec.media:[{id:'source-needed',title:'Add verified full-program sources',videoId:'',runtimeMinutes:spec.slotMinutes,cleared:false,sourceUrl:''}];
    return 'window.CHANNEL_CATALOG = '+JSON.stringify(items,null,2)+';\n';
  }

  function generatedIndex(spec){
    const site='https://'+spec.owner+'.github.io/'+spec.repo+'/';
    return '<!doctype html>\n<html lang="en">\n<head>\n'+
      '  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071426">\n'+
      '  <title>'+html(spec.name)+'</title><meta name="description" content="'+html(spec.brief.slice(0,170)||('Synchronized '+spec.name+' channel'))+'">\n'+
      '  <link rel="canonical" href="'+site+'"><meta property="og:type" content="website"><meta property="og:title" content="'+html(spec.name)+' — Live Channel"><meta property="og:description" content="'+html(spec.brief.slice(0,180))+'"><meta property="og:url" content="'+site+'"><meta property="og:image" content="'+site+'assets/channel-share.svg?v=1"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+html(spec.name)+' — Live Channel"><meta name="twitter:image" content="'+site+'assets/channel-share.svg?v=1">\n'+
      '  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n'+
      '  <header class="masthead"><a class="brand" href="#top"><span class="brand-mark">'+html(spec.name.charAt(0).toUpperCase())+'</span><span>'+html(spec.name)+'</span></a><details class="channel-menu"><summary aria-label="Open channel menu">☰ <span>Channels</span></summary><nav></nav></details><div class="on-air"><i></i> ON AIR</div><time id="stationClock">--:--</time></header>\n'+
      '  <main id="top"><section class="theater"><div class="marquee"><div><p id="modeLabel">LIVE CHANNEL</p><h1 id="nowTitle">Loading '+html(spec.name)+'…</h1></div><div id="programTime">Please wait</div></div><div class="screen-shell"><div id="player" class="player"></div><div id="stationCard" class="station-card"><p>'+html(spec.name)+'</p><strong id="stationCardTitle">Preparing the live schedule</strong><span id="stationCardNote"></span></div><button id="enterButton" class="enter-button">Enter '+html(spec.name)+'</button></div><div class="controls"><button id="startOverButton">Start over</button><button id="rewindButton">Rewind 30 sec</button><button id="liveButton">Join live</button><button id="shareButton">Share · +1/10 ⭐</button><span id="shareStatus"></span></div><div class="progress-track"><div id="progressBar"></div></div></section>\n'+
      '  <section class="next-up"><div class="section-heading"><p>ONE CHANNEL · ONE SHARED MOMENT</p><h2>Next on '+html(spec.name)+'</h2></div><div id="nextCards" class="next-grid"></div></section>\n'+
      '  <section class="guide"><div class="section-heading"><p>'+html(spec.rotation.toUpperCase())+' PROGRAMMING · '+(spec.rules.midnightRollover?'RESETS AT 12:00 AM LOCAL TIME':'CLOCK-BASED LIVE ROTATION')+'</p><h2>TV guide</h2></div><div id="guideRows" class="guide-rows"></div></section></main>\n'+
      '  <footer><strong>'+html(spec.name)+'</strong><span>'+html(spec.brief.slice(0,150))+'</span></footer>\n'+
      '  <script>window.CHANNEL_CONFIG='+JSON.stringify(spec).replace(/<\//g,'<\\/')+';<\/script>\n'+
      '  <script src="data/catalog.js?v=1"><\/script><script src="channel.js?v=1"><\/script>\n'+
      '  <script>(function(){var s=document.createElement("script");s.src="https://www-infinity4.github.io/Omni-Control/channels.js?v=network1";s.onerror=function(){var f=document.createElement("script");f.src="https://www-infinity4.github.io/TNT/channels.js?v=20260913-week2";document.body.appendChild(f)};document.body.appendChild(s)})();<\/script>\n'+
      '</body>\n</html>\n';
  }

  function generatedStyles(){
    return ':root{color-scheme:dark;--bg:#06101d;--panel:#0c1928;--line:#28405a;--text:#f7fbff;--muted:#9bb0c4;--accent:#f2c45f}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#1a3f68,transparent 40%),#06101d;color:var(--text);font-family:system-ui,-apple-system,Segoe UI,sans-serif}.masthead{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:12px 16px;background:rgba(4,11,19,.92);border-bottom:1px solid rgba(255,255,255,.1);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:9px;margin-right:auto;color:#fff;text-decoration:none;font-weight:900}.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#f2c45f;color:#14100a}.channel-menu{position:relative}.channel-menu summary{list-style:none;cursor:pointer;border:1px solid #39516a;border-radius:999px;padding:9px 12px;font-weight:800}.channel-menu summary::-webkit-details-marker{display:none}.channel-menu nav{position:absolute;right:0;top:calc(100% + 8px);width:min(310px,90vw);max-height:72vh;overflow:auto;display:grid;gap:4px;padding:9px;border-radius:14px;background:#050b12;border:1px solid #30445a}.channel-menu nav a{padding:9px 10px;border-radius:9px;color:#fff;text-decoration:none;background:#0d1b2a}.on-air{font-size:12px;font-weight:900;letter-spacing:.1em}.on-air i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5d5d;margin-right:5px}main{max-width:1240px;margin:0 auto;padding:22px 14px 60px}.theater,.next-up,.guide{background:linear-gradient(180deg,#0f2135,#091523);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:15px;margin-bottom:14px}.marquee,.section-heading{display:flex;justify-content:space-between;align-items:end;gap:12px}.marquee p,.section-heading p{margin:0;color:#f2c45f;font-size:11px;font-weight:900;letter-spacing:.13em}.marquee h1,.section-heading h2{margin:4px 0 0}.screen-shell{position:relative;aspect-ratio:16/9;margin-top:13px;background:#000;border-radius:15px;overflow:hidden}.player{position:absolute;inset:0}.player iframe{width:100%;height:100%;border:0}.station-card{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:26px;background:radial-gradient(circle,#132b48,#050b12)}.station-card[hidden]{display:none}.station-card p{color:#f2c45f;font-weight:900;letter-spacing:.15em}.station-card strong{font-size:clamp(1.5rem,5vw,3rem)}.station-card span{color:#9fb3c7;margin-top:8px}.enter-button{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);border:0;border-radius:999px;padding:13px 19px;background:#f2c45f;color:#19140b;font-weight:950}.controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.controls button{border:1px solid #38516c;background:#0a1827;color:#fff;border-radius:999px;padding:9px 12px;font-weight:800}.controls #shareStatus{align-self:center;color:#a7bbce;font-size:12px}.progress-track{height:5px;margin-top:11px;border-radius:99px;background:#1d3042;overflow:hidden}.progress-track div{height:100%;width:0;background:#f2c45f}.next-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:12px}.next-card,.guide-row{border:1px solid #263d55;background:#081725;border-radius:12px;padding:11px}.next-card time,.guide-row time{color:#f2c45f;font-size:12px;font-weight:900}.next-card strong,.guide-row strong{display:block;margin-top:4px}.next-card span,.guide-row span{display:block;color:#8fa5b9;font-size:12px;margin-top:3px}.guide-rows{display:grid;gap:7px;margin-top:12px}.guide-row{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center}.guide-row.current{outline:2px solid #f2c45f}footer{max-width:1240px;margin:0 auto 28px;padding:16px;color:#8198ad;display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,.09)}@media(max-width:700px){.masthead{gap:9px}.on-air{display:none}.masthead time{font-size:12px}.next-grid{grid-template-columns:1fr}.guide-row{grid-template-columns:74px 1fr}.guide-row span{grid-column:2}.marquee,.section-heading{align-items:start;flex-direction:column}footer{flex-direction:column;gap:5px}}\n';
  }

  function generatedRuntime(){
    return `(function(){'use strict';
var cfg=window.CHANNEL_CONFIG||{};var catalog=Array.isArray(window.CHANNEL_CATALOG)?window.CHANNEL_CATALOG:[];var slot=Math.max(300,Number(cfg.slotMinutes||60)*60);var player=null,ready=false,entered=false,mode='live',shiftBase=0,shiftStarted=0,loaded='';
function el(id){return document.getElementById(id)}function nowMs(){return mode==='live'?Date.now():shiftBase+(Date.now()-shiftStarted)}function parts(ms){var d=new Date(ms);return{y:d.getFullYear(),m:d.getMonth(),day:d.getDate()}}function midnight(ms){var p=parts(ms);return new Date(p.y,p.m,p.day,0,0,0,0).getTime()}function dayKey(ms){var d=new Date(ms);var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(cfg.rotation==='weekly'){var onejan=new Date(d.getFullYear(),0,1);var week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);key=d.getFullYear()+'-W'+week}return key}function hash(s){var h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}function shuffle(items,seedText){var a=items.slice(),seed=hash(seedText);function rand(){seed+=0x6D2B79F5;var t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}for(var i=a.length-1;i>0;i--){var j=Math.floor(rand()*(i+1));var x=a[i];a[i]=a[j];a[j]=x}return a}function schedule(ms){var start=midnight(ms),count=Math.ceil(86400/slot),list=catalog.length?catalog:[{id:'source-needed',title:'Add verified full-program sources',videoId:'',runtimeMinutes:cfg.slotMinutes||60,cleared:false}],cycle=shuffle(list,dayKey(ms)+':'+(cfg.id||cfg.name||'channel'));var out=[];for(var i=0;i<count;i++){var item=cycle[i%cycle.length];out.push({id:dayKey(ms)+'-'+i,item:item,start:start+i*slot*1000,end:start+(i+1)*slot*1000})}return out}function active(ms){var list=schedule(ms),t=ms;for(var i=0;i<list.length;i++)if(t>=list[i].start&&t<list[i].end)return{list:list,index:i,block:list[i]};return{list:list,index:0,block:list[0]}}function fmt(ms){return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(ms))}function art(item){return item.videoId?'https://i.ytimg.com/vi/'+item.videoId+'/maxresdefault.jpg':''}function renderGuide(state){var rows=el('guideRows');if(!rows)return;rows.innerHTML=state.list.map(function(b){return'<article class="guide-row '+(b.id===state.block.id?'current':'')+'"><time>'+fmt(b.start)+'</time><strong>'+escapeHtml(b.item.title)+'</strong><span>'+Math.round(Number(b.item.runtimeMinutes||cfg.slotMinutes||60))+' min</span></article>'}).join('')}function renderNext(state){var root=el('nextCards');if(!root)return;var cards=[];for(var s=1;s<=3;s++){var b=state.list[(state.index+s)%state.list.length];cards.push('<article class="next-card"><time>'+fmt(b.start)+'</time><strong>'+escapeHtml(b.item.title)+'</strong><span>'+Math.round(Number(b.item.runtimeMinutes||cfg.slotMinutes||60))+' min</span></article>')}root.innerHTML=cards.join('')}function escapeHtml(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function showCard(item,note){el('stationCard').hidden=false;el('stationCardTitle').textContent=item.title;el('stationCardNote').textContent=note||'Intermission / source pending'}function load(state,elapsed){if(!entered)return;var item=state.block.item,key=state.block.id+':'+item.videoId;if(!item.videoId||!item.cleared){showCard(item,'Add a verified full-program YouTube source in data/catalog.js');if(ready&&player)player.stopVideo();loaded=key;return}el('stationCard').hidden=true;if(!ready)return;if(loaded!==key){loaded=key;player.loadVideoById({videoId:item.videoId,startSeconds:Math.max(0,Math.min(elapsed,Math.max(0,Number(item.runtimeMinutes||60)*60-2)))})}else if(mode==='live'&&player&&player.getPlayerState&&player.getPlayerState()===1){var drift=elapsed-player.getCurrentTime();if(Math.abs(drift)>3)player.seekTo(elapsed,true)}}
function tick(){var ms=nowMs(),state=active(ms),b=state.block,elapsed=Math.max(0,Math.floor((ms-b.start)/1000));el('stationClock').textContent=fmt(Date.now())+' local';el('nowTitle').textContent=b.item.title;el('programTime').textContent=fmt(b.start)+'–'+fmt(b.end);el('modeLabel').textContent=mode==='live'?'LIVE CHANNEL':'TIME SHIFTED';el('progressBar').style.width=Math.min(100,elapsed/slot*100)+'%';var a=art(b.item);if(a)document.body.style.backgroundImage='linear-gradient(rgba(6,16,29,.93),rgba(6,16,29,.97)),url('+a+')';renderGuide(state);renderNext(state);load(state,elapsed)}
function loadApi(){if(window.YT&&window.YT.Player){window.onYouTubeIframeAPIReady();return}var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s)}window.onYouTubeIframeAPIReady=function(){player=new YT.Player('player',{width:'100%',height:'100%',playerVars:{playsinline:1,controls:1,enablejsapi:1,origin:location.origin},events:{onReady:function(){ready=true;tick()},onError:function(){showCard(active(nowMs()).block.item,'Video unavailable. Replace this source in data/catalog.js')}}})};
el('enterButton').addEventListener('click',function(){entered=true;this.hidden=true;loadApi();tick()});el('startOverButton').addEventListener('click',function(){var s=active(Date.now());mode='shift';shiftBase=s.block.start;shiftStarted=Date.now();loaded='';tick()});el('rewindButton').addEventListener('click',function(){mode='shift';shiftBase=nowMs()-30000;shiftStarted=Date.now();loaded='';tick()});el('liveButton').addEventListener('click',function(){mode='live';loaded='';tick()});el('shareButton').addEventListener('click',async function(){var share={title:document.title,text:'Watch '+el('nowTitle').textContent+' live on '+document.title,url:location.href};try{if(navigator.share){await navigator.share(share);el('shareStatus').textContent='Shared · StarCoin progress handled by the shared network wallet.'}else{await navigator.clipboard.writeText(location.href);el('shareStatus').textContent='Link copied.'}}catch(e){if(!e||e.name!=='AbortError')el('shareStatus').textContent='Share did not complete.'}});tick();setInterval(tick,1000);
})();\n`;
  }

  function shareSvg(spec){
    const title=html(spec.name).replace(/&/g,'&amp;');
    const subtitle=html((spec.type+' · live synchronized channel').toUpperCase()).replace(/&/g,'&amp;');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071426"/><stop offset="1" stop-color="#193c63"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect x="70" y="72" width="1060" height="486" rx="44" fill="#091827" stroke="#3d5e7d" stroke-width="3"/><circle cx="160" cy="160" r="52" fill="#f2c45f"/><text x="160" y="178" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="52" fill="#17120a">'+html(spec.name.charAt(0).toUpperCase())+'</text><text x="90" y="315" font-family="Arial,sans-serif" font-weight="900" font-size="72" fill="#ffffff">'+title+'</text><text x="92" y="380" font-family="Arial,sans-serif" font-weight="700" font-size="28" letter-spacing="5" fill="#f2c45f">'+subtitle+'</text><text x="92" y="485" font-family="Arial,sans-serif" font-size="26" fill="#9eb3c8">THE MOVIE / SHOW IS ALREADY PLAYING · JOIN LIVE</text></svg>';
  }

  function readme(spec){
    return '# '+spec.name+'\n\nGenerated by **Channel Creatir**.\n\n## Programming brief\n\n'+(spec.brief||'Synchronized Infinity TV channel.')+'\n\n## Network rules\n\n- Slot size: '+spec.slotMinutes+' minutes\n- Rotation: '+spec.rotation+'\n- Synchronized live clock: '+(spec.rules.synced?'yes':'no')+'\n- Midnight local rollover: '+(spec.rules.midnightRollover?'yes':'no')+'\n- Full-program sources only: '+(spec.rules.fullContentOnly?'yes':'no')+'\n- Future advertising/intermission space: '+(spec.rules.intermission?'yes':'no')+'\n- Shared remote: Omni Control with TNT fallback\n- Share progress: 1/10 StarCoin hook through the shared network remote\n\n## Media\n\nEdit `data/catalog.js` when a source changes. Every playable item needs a real full-program YouTube video ID and runtime. Unverified entries deliberately render a station card instead of pretending a trailer or broken video is the program.\n';
  }

  function makeFiles(spec){
    return {
      '.nojekyll':'\n',
      'README.md':readme(spec),
      'index.html':generatedIndex(spec),
      'styles.css':generatedStyles(),
      'channel.js':generatedRuntime(),
      'data/catalog.js':catalogFile(spec),
      'channel.manifest.json':JSON.stringify(spec,null,2)+'\n',
      'assets/channel-share.svg':shareSvg(spec)
    };
  }

  function renderBuild(spec,files){
    outputTitle.textContent=spec.name;
    buildState.textContent='GENERATED';
    summary.className='summary';
    summary.innerHTML='<div class="summary-grid"><div><strong>'+html(spec.repo)+'</strong><span>GitHub repository</span></div><div><strong>'+spec.slotMinutes+' min</strong><span>default slot</span></div><div><strong>'+html(spec.type)+'</strong><span>programming mode</span></div><div><strong>'+html(spec.rotation)+'</strong><span>rotation</span></div><div><strong>'+spec.media.filter(m=>m.cleared).length+' playable</strong><span>verified media lines</span></div><div><strong>Omni Control</strong><span>remote source with fallback</span></div></div>';
    manifestCode.textContent=JSON.stringify(spec,null,2);
    fileList.innerHTML='';
    Object.keys(files).forEach((name,index)=>{
      const b=document.createElement('button');b.type='button';b.className='file-chip'+(index===0?' active':'');b.textContent=name;b.addEventListener('click',()=>{document.querySelectorAll('.file-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');fileCode.textContent=files[name]});fileList.appendChild(b);
    });
    fileCode.textContent=files[Object.keys(files)[0]];
    const previewHtml=files['index.html'].replace('<link rel="stylesheet" href="styles.css">','<style>'+files['styles.css']+'</style>').replace('<script src="data/catalog.js?v=1"><\/script>','<script>'+files['data/catalog.js']+'<\/script>').replace('<script src="channel.js?v=1"><\/script>','<script>'+files['channel.js'].replace(/<\/script/gi,'<\\/script')+'<\/script>');
    previewFrame.srcdoc=previewHtml;
    deployLog.hidden=true;
  }

  function generate(){
    parseBrief();
    const spec=buildSpec();
    const files=makeFiles(spec);
    lastBuild={spec,files};
    renderBuild(spec,files);
    return lastBuild;
  }

  async function ghRequest(token,method,path,body){
    const res=await fetch('https://api.github.com'+path,{method,headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    let data=null;try{data=await res.json()}catch(_){data=null}
    if(!res.ok){const err=new Error((data&&data.message)||('GitHub '+res.status));err.status=res.status;err.data=data;throw err}
    return data;
  }

  function base64Utf8(text){
    const bytes=new TextEncoder().encode(text);let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);
  }

  async function ensureRepo(token,spec){
    try{return await ghRequest(token,'GET','/repos/'+encodeURIComponent(spec.owner)+'/'+encodeURIComponent(spec.repo))}
    catch(e){
      if(e.status!==404) throw e;
      return await ghRequest(token,'POST','/user/repos',{name:spec.repo,description:'Infinity TV channel generated by Channel Creatir',private:false,auto_init:true,has_issues:true,has_projects:false,has_wiki:false});
    }
  }

  async function upsertFile(token,spec,path,content){
    const apiPath='/repos/'+encodeURIComponent(spec.owner)+'/'+encodeURIComponent(spec.repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
    let sha=null;
    try{const current=await ghRequest(token,'GET',apiPath);sha=current.sha||null}catch(e){if(e.status!==404)throw e}
    const body={message:(sha?'Update ':'Add ')+path+' via Channel Creatir',content:base64Utf8(content),branch:'main'};if(sha)body.sha=sha;
    return ghRequest(token,'PUT',apiPath,body);
  }

  async function enablePages(token,spec){
    const path='/repos/'+encodeURIComponent(spec.owner)+'/'+encodeURIComponent(spec.repo)+'/pages';
    try{return await ghRequest(token,'POST',path,{source:{branch:'main',path:'/'}})}catch(e){if(e.status===409||e.status===422){try{return await ghRequest(token,'GET',path)}catch(_){return null}}throw e}
  }

  async function deploy(){
    const token=githubToken.value.trim();
    if(!token){deployLog.hidden=false;deployLog.className='deploy-log error';deployLog.textContent='Add a GitHub token in GitHub deployment first. Creatir never stores it.';document.querySelector('.github-box').open=true;return}
    const build=generate();
    deployButton.disabled=true;buildState.textContent='DEPLOYING';deployLog.hidden=false;deployLog.className='deploy-log';deployLog.textContent='Checking '+build.spec.owner+'/'+build.spec.repo+'…';
    try{
      await ensureRepo(token,build.spec);
      const names=Object.keys(build.files);
      for(let i=0;i<names.length;i++){
        const name=names[i];deployLog.textContent='Deploying '+(i+1)+'/'+names.length+': '+name;await upsertFile(token,build.spec,name,build.files[name]);
      }
      let pages=null;try{pages=await enablePages(token,build.spec)}catch(e){deployLog.textContent+='\nFiles are deployed. GitHub Pages could not be enabled automatically: '+e.message}
      const site=(pages&&pages.html_url)||('https://'+build.spec.owner+'.github.io/'+build.spec.repo+'/');
      deployLog.className='deploy-log success';deployLog.innerHTML='Deployed <strong>'+html(build.spec.owner+'/'+build.spec.repo)+'</strong>.<br>Channel URL: <a href="'+html(site)+'" target="_blank" rel="noopener">'+html(site)+'</a><br>The generated page loads Omni Control first and automatically falls back to the current TNT remote if Omni Control is not available yet.';
      buildState.textContent='DEPLOYED';
    }catch(e){deployLog.className='deploy-log error';deployLog.textContent='Deploy failed: '+e.message+(e.status?' (GitHub '+e.status+')':'')+'. If the repository belongs to another account or Pages cannot be changed, create the repo first or give the token the matching repository/Pages permissions.';buildState.textContent='ERROR'}finally{deployButton.disabled=false}
  }

  $('sampleButton').addEventListener('click',()=>{brief.value=sample;channelName.value='';repoName.value='';parseBrief()});
  form.addEventListener('submit',e=>{e.preventDefault();generate()});
  deployButton.addEventListener('click',deploy);
  brief.addEventListener('change',parseBrief);
  channelName.addEventListener('input',()=>{if(!repoName.dataset.manual)repoName.value=slugify(channelName.value)});
  repoName.addEventListener('input',()=>{repoName.dataset.manual='1'});
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));tab.classList.add('active');document.querySelector('[data-panel="'+tab.dataset.tab+'"]').classList.add('active')}));
})();
