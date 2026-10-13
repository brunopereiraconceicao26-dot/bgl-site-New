(function(){
  function $(s,r){return (r||document).querySelector(s)}
  function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}

  /* Menu e painel de soluções */
  var burger=$('#burger'),nav=$('#mainnav'),solBtn=$('#solBtn'),mega=$('#mega');
  function setMega(o){if(!mega)return;mega.hidden=!o;solBtn.setAttribute('aria-expanded',o)}
  if(solBtn){
    solBtn.addEventListener('click',function(e){e.stopPropagation();setMega(mega.hidden)});
    document.addEventListener('click',function(e){if(!mega.hidden&&!mega.contains(e.target)&&e.target!==solBtn)setMega(false)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')setMega(false)});
  }
  if(burger){burger.addEventListener('click',function(){var o=nav.classList.toggle('open');burger.setAttribute('aria-expanded',o)})}

  /* Banner rotativo */
  var hero=$('#hero');
  if(hero){
    var slides=$$('.slide',hero),dots=$$('.dots button',hero),pp=$('#pp'),snum=$('#snum');
    var cur=0,timer=null,paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function plan(){clearTimeout(timer);if(!paused)timer=setTimeout(function(){go(cur+1)},7000)}
    function go(i){
      slides[cur].classList.remove('on');dots[cur].classList.remove('on');dots[cur].setAttribute('aria-selected','false');
      cur=(i+slides.length)%slides.length;
      slides[cur].classList.add('on');var b=dots[cur];void b.offsetWidth;b.classList.add('on');b.setAttribute('aria-selected','true');
      snum.textContent='0'+(cur+1)+' / 0'+slides.length;plan();
    }
    function setPause(p){paused=p;hero.classList.toggle('paused',p);pp.textContent=p?'▶':'II';pp.setAttribute('aria-label',p?'Retomar destaques':'Pausar destaques');plan()}
    dots.forEach(function(d,i){d.addEventListener('click',function(){go(i)})});
    pp.addEventListener('click',function(){setPause(!paused)});
    hero.addEventListener('focusin',function(){clearTimeout(timer)});
    setPause(paused);
  }

  /* Segmentos */
  var segPanel=$('#seg-panel');
  if(segPanel){
    var seg={
      'tab-ind':['Indústria','Energia confiável, ativos acompanhados e plantas conectadas, da entrada de energia ao chão de fábrica.',[['Painéis e instalações elétricas','eletrica.html'],['Ensaios em motores e transformadores','ensaios.html'],['Termografia de painéis e ativos','plataformas.html#thermo'],['Redes de fibra óptica e dados','telecom.html'],['Automação e supervisão','automacao.html'],['CFTV e controle de acesso','seguranca.html'],['Detecção e alarme de incêndio','incendio.html']]],
      'tab-ene':['Energia','Diagnóstico de ativos de potência, comunicação entre áreas operacionais e segurança patrimonial para usinas e subestações.',[['Diagnóstico de isolamento de geradores','ensaios.html'],['Análise de óleo isolante','plataformas.html#oilscan'],['Termografia de ativos','plataformas.html#thermo'],['Topologia de rede óptica','telecom.html'],['Pareceres técnicos','ensaios.html'],['Controle de acesso e CFTV','seguranca.html'],['Procedimentos e planos de manutenção','ensaios.html']]],
      'tab-com':['Comércio e serviços','Instalações eficientes, segurança integrada e operação sem interrupções para lojas, escritórios e clínicas.',[['Projetos e adequações elétricas','eletrica.html'],['Projetos luminotécnicos','eletrica.html'],['CFTV e controle de acesso','seguranca.html'],['Cabeamento estruturado','telecom.html'],['Automação de iluminação e clima','automacao.html'],['Alarme de incêndio','incendio.html']]],
      'tab-con':['Condomínios','Segurança, acesso e áreas comuns funcionando de forma integrada, com manutenção planejada.',[['Controle de acesso de pedestres e veículos','seguranca.html'],['CFTV com acesso remoto','seguranca.html'],['Manutenção de alarme de incêndio','incendio.html'],['SPDA e aterramento','eletrica.html'],['Automação de áreas comuns','automacao.html'],['Infraestrutura de rede','telecom.html']]],
      'tab-res':['Residências','Instalações seguras, automação residencial e câmeras acessíveis pelo celular.',[['Elétrica residencial','eletrica.html'],['Automação residencial','automacao.html'],['Câmeras com acesso pelo celular','seguranca.html'],['Fechaduras e acesso inteligente','seguranca.html'],['Rede Wi-Fi e cabeamento','telecom.html'],['Projeto luminotécnico','eletrica.html']]]
    };
    var tabs=$$('.seg-tabs button');
    function showSeg(id){
      tabs.forEach(function(t){t.setAttribute('aria-selected',t.id===id)});
      segPanel.setAttribute('aria-labelledby',id);
      var s=seg[id];$('#segT').textContent=s[0];$('#segD').textContent=s[1];
      var l=$('#segL');l.innerHTML='';
      s[2].forEach(function(x){var a=document.createElement('a');a.href=x[1];a.textContent=x[0];l.appendChild(a)});
    }
    tabs.forEach(function(t){t.addEventListener('click',function(){showSeg(t.id)})});
    showSeg('tab-ind');
  }

  /* Sumário do código de ética */
  $$('.eth-toc a').forEach(function(a){a.addEventListener('click',function(e){var t=document.getElementById(a.getAttribute('href').slice(1));if(t){e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-96,behavior:'smooth'})}})});

  /* Copiar e-mail */
  var cm=$('#copyMail');
  if(cm){cm.addEventListener('click',function(){
    var m=$('#mail');function sel(){var r=document.createRange();r.selectNodeContents(m);var s=getSelection();s.removeAllRanges();s.addRange(r);cm.textContent='selecionado'}
    try{navigator.clipboard.writeText(m.textContent).then(function(){cm.textContent='copiado'},sel)}catch(e){sel()}
  })}

  /* Formulário */
  var f=$('#cf');
  if(f){
    var areaMap={eletrica:'Elétrica',ensaios:'Ensaios e diagnóstico',telecom:'Telecom',automacao:'Automação e sistemas inteligentes',sistemas:'Desenvolvimento de aplicações',seguranca:'CFTV e controle de acesso',incendio:'Alarme de incêndio',oilscan:'BGL OilScan',thermo:'BGL Thermo Intelligence'};
    var h=(location.hash||'').slice(1);if(areaMap[h])$('#area').value=areaMap[h];
    var msg=$('#fmsg');
    function waLink(){
      var g=function(id){return $('#'+id).value.trim()};
      var t='Solicitação pelo site BGL\nNome: '+g('nome')+(g('empresa')?'\nEmpresa: '+g('empresa'):'')+'\nE-mail: '+g('email')+'\nTelefone: '+g('tel')+(g('cidade')?'\nCidade: '+g('cidade'):'')+'\nSegmento: '+g('segmento')+'\nÁrea: '+g('area')+'\nTipo: '+g('tipo')+(g('mensagem')?'\n\n'+g('mensagem'):'');
      return 'https://wa.me/5515998162971?text='+encodeURIComponent(t);
    }
    f.addEventListener('submit',function(e){
      e.preventDefault();var bad=null;
      $$('[required]',f).forEach(function(el){
        var ok=el.type==='checkbox'?el.checked:el.value.trim()!=='';
        if(ok&&el.type==='email')ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value.trim());
        var w=el.closest('.fld');if(w)w.classList.toggle('bad',!ok);
        if(!ok&&!bad)bad=el;
      });
      if(bad){msg.className='msg bad';msg.textContent=bad.id==='lgpd'?'Marque a autorização de uso dos dados para enviar.':'Revise os campos destacados para enviar.';bad.focus();return}
      function fallback(){msg.className='msg';msg.innerHTML='';var a=document.createElement('a');a.href=waLink();a.target='_blank';a.rel='noopener';a.textContent='Enviar esta solicitação pelo WhatsApp →';msg.appendChild(document.createTextNode('Para concluir, '));msg.appendChild(a)}
      if(!/bglgroup\.com\.br$|netlify\.app$/.test(location.hostname)){fallback();return}
      msg.className='msg';msg.textContent='Enviando…';
      fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f)).toString()})
        .then(function(r){if(!r.ok)throw 0;f.reset();msg.className='msg ok';msg.textContent='Solicitação enviada. Nossa equipe retornará pelo telefone ou e-mail informado.'})
        .catch(fallback);
    });
  }
})();
