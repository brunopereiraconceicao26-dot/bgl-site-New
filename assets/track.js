/* BGL — monitoramento de visitantes (sem cookies; identificador anônimo).
   Registra página, tempo na página e origem (Google, Instagram etc.). */
(function(){
  try{ if(localStorage.getItem('bglNoTrack')==='1') return; }catch(e){ return; }
  if(navigator.webdriver) return;
  if(!/bglgroup\.com\.br$|netlify\.app$/.test(location.hostname)) return;

  var URL_API='/api/track', SESSAO_MIN=30;
  function rid(){
    if(window.crypto&&crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)});
  }
  function ler(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
  function gravar(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

  /* Origem da visita */
  function porNome(s){
    s=(s||'').toLowerCase();
    if(!s) return '';
    if(/insta|^ig$|^ig_/.test(s)) return 'instagram';
    if(/google|gclid|adwords/.test(s)) return 'google';
    if(/facebook|^fb/.test(s)) return 'facebook';
    if(/whats|^wa$/.test(s)) return 'whatsapp';
    if(/linkedin|lnkd/.test(s)) return 'linkedin';
    if(/bing/.test(s)) return 'bing';
    if(/youtube|youtu\.be/.test(s)) return 'youtube';
    return 'outros';
  }
  function origem(){
    var q=new URLSearchParams(location.search), ua=navigator.userAgent||'', ref='', host='';
    try{ if(document.referrer){ var u=new URL(document.referrer); host=u.hostname.replace(/^www\./,''); ref=host; } }catch(e){}
    if(host===location.hostname.replace(/^www\./,'')){ host=''; ref=''; }
    var src='';
    if(q.get('utm_source')) src=porNome(q.get('utm_source'));
    else if(q.get('gclid')||q.get('gbraid')||q.get('wbraid')) src='google';
    else if(q.get('igshid')||q.get('igsh')) src='instagram';
    else if(/Instagram/i.test(ua)) src='instagram';
    else if(host) src=porNome(host);
    else if(/FBAN|FBAV/i.test(ua)) src='facebook';
    else if(q.get('fbclid')) src='facebook';
    return {src:src, ref:ref};
  }

  var agora=Date.now(), o=origem();
  var vid=ler('bglVid'); if(typeof vid!=='string'){ vid=rid(); gravar('bglVid',vid); }
  var s=ler('bglSessao');
  var nova=!s||!s.id||(agora-(s.t||0))>SESSAO_MIN*60000||(o.src&&o.src!==s.src);
  if(nova) s={id:rid(), src:o.src||'direto', ref:o.ref};
  s.t=agora; gravar('bglSessao',s);

  var caminho=location.pathname.replace(/\/index(\.html)?$/,'/').replace(/\.html$/,'')||'/';
  var pv=rid();
  function enviar(dados,beacon){
    var corpo=JSON.stringify(dados);
    try{
      if(beacon&&navigator.sendBeacon&&navigator.sendBeacon(URL_API,new Blob([corpo],{type:'text/plain'}))) return;
      fetch(URL_API,{method:'POST',body:corpo,keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(function(){});
    }catch(e){}
  }
  enviar({t:'v',id:pv,vid:vid,sid:s.id,path:caminho+(location.hash&&location.hash.length<40?location.hash:''),title:document.title,src:s.src,ref:nova?s.ref:''});

  /* Tempo na página: conta só enquanto a aba está visível */
  var visivel=0, desde=document.visibilityState==='visible'?Date.now():0, ultimo=-1;
  function acumula(){ if(desde){ visivel+=Date.now()-desde; desde=0; } }
  function reporta(){
    acumula();
    var seg=Math.round(visivel/1000);
    if(seg!==ultimo&&seg>0){ ultimo=seg; enviar({t:'d',id:pv,d:seg},true); }
    var x=ler('bglSessao'); if(x&&x.id===s.id){ x.t=Date.now(); gravar('bglSessao',x); }
  }
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden') reporta(); else desde=Date.now();
  });
  window.addEventListener('pagehide',reporta);
  /* Aviso periódico para visitas longas (a cada 60 s visíveis) */
  setInterval(function(){ if(document.visibilityState==='visible'){ acumula(); desde=Date.now(); var seg=Math.round(visivel/1000); if(seg-ultimo>=60){ ultimo=seg; enviar({t:'d',id:pv,d:seg}); } } },15000);
})();
