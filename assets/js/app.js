/* ============================================================
   2026 世界杯预言 — 渲染层
   ============================================================ */
(function(){
  const { META, TEAMS, GROUPS, KNOCKOUT, CHAMPION_PATH, PROFILES } = window.WC;

  /* ---------- 工具 ---------- */
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
  const flagUrl = (code,w=40)=>`https://flagcdn.com/w${w}/${TEAMS[code].f}.png`;
  const flagImg = (code,w=40,cls='flagimg')=>`<img class="${cls}" src="${flagUrl(code,w)}" alt="${TEAMS[code].n}" loading="lazy" />`;

  /* ---------- 焦点战 ---------- */
  const FOCUS = new Set([
    'NOR-FRA','FRA-NOR','ARG-POR','POR-ARG','BRA-GER','GER-BRA',
    'FRA-ENG','ENG-FRA','BRA-FRA','FRA-BRA','ESP-ARG','ARG-ESP','FRA-ESP','ESP-FRA'
  ]);
  const isFocus = (h,a)=>FOCUS.has(`${h}-${a}`);
  /* 冠军之路高亮（法国经过的所有淘汰赛） */
  const CHAMP = META.champion;
  const onChampPath = (h,a)=> h===CHAMP||a===CHAMP;

  /* ============ 1. 冠军卡 & 顶部数据 ============ */
  function renderHero(){
    const c = TEAMS[CHAMP];
    $('#champFlag').src = flagUrl(CHAMP,160);
    $('#champName').textContent = c.n;
    $('#champRating').innerHTML = `实力分 <b>${c.r}</b> · 夺冠概率 <b>${c.o}%</b>`;
    $('#champPath').textContent = CHAMPION_PATH.map(p=>`${p.round} ${p.score}`).join('  ›  ');

    $('#navMeta').innerHTML = `数据截至 ${META.updated}<br/>蒙特卡洛 ${META.monteCarlo.toLocaleString()} 次`;
    $('#footerMeta').innerHTML = `数据截至 <b style="color:var(--gold);font-family:var(--fm)">${META.updated}</b><br/>模型更新 ${META.modelUpdate}<br/>半衰期 ${META.halfLife}`;

    const stats = [
      {n:'48',u:'支',l:'参赛球队'},
      {n:'104',u:'场',l:'比赛场次'},
      {n:(META.monteCarlo/1000)+'K',u:'次',l:'蒙特卡洛模拟'},
      {n:TEAMS[CHAMP].o,u:'%',l:`${TEAMS[CHAMP].n}夺冠概率`},
    ];
    $('#keystats').innerHTML = stats.map(s=>`
      <div class="ks reveal"><div class="ks__num">${s.n}<small>${s.u}</small></div>
      <div class="ks__label">${s.l}</div></div>`).join('');

    $('#championPathDesc').innerHTML = `从 32 强到决赛，<strong style="color:var(--gold)">${c.n}</strong> 六战封王的完整路径。每一场都是模型推演的最可能结局。`;
  }

  /* ============ 2. 夺冠概率榜 ============ */
  function renderPower(){
    const ranked = Object.entries(TEAMS)
      .map(([c,t])=>({c,...t}))
      .filter(t=>t.o>=1.0)
      .sort((a,b)=>b.o-a.o);
    const max = ranked[0].o;
    $('#powerList').innerHTML = ranked.map((t,i)=>`
      <div class="power-row reveal ${i<3?'is-top':''}">
        <div class="power-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="power-main">
          ${flagImg(t.c,80,'power-flag')}
          <div style="flex:1;min-width:0">
            <div class="power-name">${t.n}<small>${t.g}组 · 实力 ${t.r}</small></div>
            <div class="power-bar"><div class="power-bar__fill" data-pct="${(t.o/max*100).toFixed(1)}"></div></div>
          </div>
        </div>
        <div class="power-pct">${t.o.toFixed(1)}%</div>
      </div>`).join('');
  }

  /* ============ 3. 小组赛 ============ */
  function calcStandings(matches){
    const t = {};
    matches.forEach(m=>{
      const [g,v,h_,h,a,hs,as] = m;
      [h,a].forEach(c=>{ if(!t[c]) t[c]={c,p:0,w:0,d:0,l:0,gf:0,ga:0}; });
      t[h].p++; t[a].p++;
      t[h].gf+=hs; t[h].ga+=as;
      t[a].gf+=as; t[a].ga+=hs;
      if(hs>as){t[h].w++;t[a].l++;t[h].p2=(t[h].p2||0)+3;}
      else if(hs<as){t[a].w++;t[h].l++;t[a].p2=(t[a].p2||0)+3;}
      else{t[h].d++;t[a].d++;t[h].p2=(t[h].p2||0)+1;t[a].p2=(t[a].p2||0)+1;}
    });
    return Object.values(t).map(x=>({...x,pts:x.w*3+x.d,gd:x.gf-x.ga})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
  }

  function matchCard(m){
    const [g,v,h_,h,a,hs,as,played,pw,pd,pl,ts] = m;
    const hostMark = h_ ? 'home-host' : '';
    const scoreCls = played ? 'done' : 'pred';
    const score = played
      ? `<span>${hs}</span><span class="dash">:</span><span>${as}</span>`
      : `<span>${hs}</span><span class="dash">:</span><span>${as}</span>`;
    const tops = ts.slice(0,3).map(s=>`<b>${s[0]}</b> ${s[1]}%`).join(' · ');
    return `<div class="match">
      <div class="match__side"><span class="match__flag">${flagImg(h,40)}</span><span class="match__name ${hostMark}">${TEAMS[h].n}</span></div>
      <div class="match__score ${scoreCls}">${score}</div>
      <div class="match__side match__side--away"><span class="match__flag">${flagImg(a,40)}</span><span class="match__name">${TEAMS[a].n}</span></div>
      <div class="match__meta">
        <span class="match__venue">${v}</span>
        <div class="probs"><span class="pw" style="width:${pw}%"></span><span class="pd" style="width:${pd}%"></span><span class="pl" style="width:${pl}%"></span></div>
        <span class="probs-legend">${pw}/${pd}/${pl}</span>
        <span class="match__topscore">最可能 ${tops}</span>
      </div>
    </div>`;
  }

  function renderGroups(){
    // 标签
    const codes = 'ABCDEFGHIJKL'.split('');
    $('#groupTabs').innerHTML = codes.map((c,i)=>`<button class="gtab ${i===0?'active':''}" data-g="${c}">${c} 组</button>`).join('');
    // 各组
    const html = codes.map(c=>{
      const ms = GROUPS.filter(m=>m[0]===c);
      const standings = calcStandings(ms);
      const qualified = standings.slice(0,2);
      const third = standings[2];
      return `<div class="group-block reveal ${c!=='A'?'hide':''}" data-block="${c}">
        <div class="group-block__head">
          <div class="group-block__title"><em>${c}</em>组</div>
          <div class="group-block__meta">出线：${qualified.map(t=>TEAMS[t.c].n).join('、')}${third&&third.pts>=4?` · 最佳第三候选 ${TEAMS[third.c].n}`:''}</div>
        </div>
        ${standings.length?`<table class="standings"><tbody>${
          standings.map((t,i)=>`<tr class="${i<2?'qual':''}">
            <td class="s-rank">${i+1}</td>
            <td class="s-flag">${flagImg(t.c,40)}</td>
            <td class="s-name">${TEAMS[t.c].n}</td>
            <td class="s-rec">${t.w}${t.d}${t.l}</td>
            <td class="s-gd">${t.gd>0?'+':''}${t.gd}</td>
            <td class="s-pts">${t.pts}</td>
          </tr>`).join('')
        }</tbody></table>`:''}
        <div class="matches">${ms.map(matchCard).join('')}</div>
      </div>`;
    }).join('');
    $('#groupStage').innerHTML = html;
    // 标签切换
    $$('.gtab').forEach(btn=>btn.addEventListener('click',()=>{
      $$('.gtab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $$('.group-block').forEach(b=>b.classList.add('hide'));
      $(`[data-block="${btn.dataset.g}"]`).classList.remove('hide');
    }));
  }

  /* ============ 4. 淘汰赛 BRACKET ============ */
  function koCard(m, roundLabel, isFinal=false){
    const {d,v,h,a,hs,as,w,et,note} = m;
    const focus = isFocus(h,a);
    const champ = onChampPath(h,a);
    const cls = ['ko-card', isFinal?'is-final':'', focus?'is-focus':'', champ?'is-champ':''].filter(Boolean).join(' ');
    const winH = w===h, winA = w===a;
    return `<div class="${cls}">
      ${focus?`<span class="focus-tag">焦点战</span>`:''}
      <div class="ko-card__round">${roundLabel}<span class="ko-card__date">${d}</span></div>
      <div class="ko-team ${winH?'win':'lose'}">
        <span class="ko-team__flag">${flagImg(h,40)}</span>
        <span class="ko-team__name">${TEAMS[h].n}</span>
        <span class="ko-team__score ${winH&&et?'et':''}">${hs}</span>
      </div>
      <div class="ko-team ${winA?'win':'lose'}">
        <span class="ko-team__flag">${flagImg(a,40)}</span>
        <span class="ko-team__name">${TEAMS[a].n}</span>
        <span class="ko-team__score ${winA&&et?'et':''}">${as}</span>
      </div>
      <div class="ko-card__note">${note}</div>
    </div>`;
  }

  function renderBracket(){
    const col = (label,arr,final=false)=>`<div class="bracket__col">
      <div class="bracket__col-title">${label}</div>
      ${arr.map(m=>koCard(m,'',final)).join('')}
    </div>`;
    // 32强内部2列网格
    const r32 = KNOCKOUT.r32;
    const half = Math.ceil(r32.length/2);
    const r32html = `<div class="bracket__col bracket__col--r32">
      <div class="bracket__col-title">32 强 · <em>Round of 32</em></div>
      <div class="r32-grid">
        <div>${r32.slice(0,half).map(m=>koCard(m,'')).join('')}</div>
        <div>${r32.slice(half).map(m=>koCard(m,'')).join('')}</div>
      </div>
    </div>`;
    $('#bracketTree').innerHTML = r32html +
      col('16 强 · <em>R16</em>', KNOCKOUT.r16) +
      col('8 强 · <em>QF</em>', KNOCKOUT.qf) +
      col('4 强 · <em>SF</em>', KNOCKOUT.sf) +
      `<div class="bracket__col">
        <div class="bracket__col-title">决赛 · <em>Final</em></div>
        ${koCard(KNOCKOUT.final[0],'',true)}
        <div style="margin-top:18px"><div class="bracket__col-title" style="opacity:.6">季军战</div>${koCard(KNOCKOUT.third[0],'')}</div>
       </div>`;
  }

  /* ============ 5. 冠军之路时间线 ============ */
  function renderPath(){
    $('#pathTimeline').innerHTML = CHAMPION_PATH.map((p,i)=>`
      <div class="path-step reveal">
        <div class="path-step__dot">${i+1}</div>
        <div class="path-step__body">
          <div class="path-step__flag">${flagImg(p.code,80)}</div>
          <div class="path-step__opp">${p.round} vs ${p.opp}<small>${p.star}</small></div>
          <div class="path-step__score">${p.score}</div>
        </div>
      </div>`).join('');
  }

  /* ============ 6. 球队档案 ============ */
  function renderProfiles(){
    $('#profiles').innerHTML = PROFILES.map(p=>`
      <div class="profile reveal">
        <div class="profile__head">
          <div class="profile__flag">${flagImg(p.c,160)}</div>
          <div class="profile__title">${TEAMS[p.c].n}<br/><span style="font-size:12px;color:var(--text-mute);font-weight:400;font-family:var(--fb)">${p.title}</span></div>
          <div class="profile__rating"><b>${p.rating}</b><small>实力 · ${p.odds}</small></div>
        </div>
        <dl>
          <div class="profile__row"><dt>核心</dt><dd>${p.core}</dd></div>
          <div class="profile__row"><dt>历史</dt><dd>${p.history}</dd></div>
          <div class="profile__row"><dt>优势</dt><dd><b style="color:var(--win)">▲</b> ${p.edge}</dd></div>
          <div class="profile__row"><dt>风险</dt><dd><b style="color:var(--loss)">▼</b> ${p.risk}</dd></div>
        </dl>
      </div>`).join('');
  }

  /* ============ 方法论元数据 ============ */
  function renderMethod(){
    $('#methodMeta').innerHTML = `
      <div><b>${META.monteCarlo.toLocaleString()}</b>蒙特卡洛模拟</div>
      <div><b>${META.halfLife}</b>ELO 半衰期</div>
      <div><b>${META.window}</b>数据窗口</div>
      <div><b>${META.updated}</b>数据截至</div>`;
  }

  /* ============ 滚动揭示 + 概率条动画 ============ */
  function observeReveal(){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in');
          // 概率条
          $$('.power-bar__fill',e.target).forEach(f=>{
            const pct=f.dataset.pct;
            if(pct) requestAnimationFrame(()=>f.style.width=pct+'%');
          });
          io.unobserve(e.target);
        }
      });
    },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    $$('.reveal').forEach(el=>io.observe(el));
  }

  /* ============ 启动 ============ */
  function init(){
    renderHero();
    renderPower();
    renderGroups();
    renderBracket();
    renderPath();
    renderProfiles();
    renderMethod();
    observeReveal();
    // 平滑滚动锚点偏移
    $$('a[href^="#"]').forEach(a=>{
      a.addEventListener('click',e=>{
        const id=a.getAttribute('href');
        if(id.length>1){ const el=$(id); if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth'}); } }
      });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
