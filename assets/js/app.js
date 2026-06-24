/* ============================================================
   2026 世界杯预言 — 渲染层
   ============================================================ */
(function(){
  const { META, TEAMS, GROUPS, KNOCKOUT, CHAMPION_PATH, PROFILES } = window.WC;
  // 记录初始实力分，用于 Elo 动态调整后的涨跌显示
  Object.keys(TEAMS).forEach(c => { TEAMS[c].r0 = TEAMS[c].r; });

  /* ---------- 工具 ---------- */
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
  const flagUrl = (code,w=40)=>`https://flagcdn.com/w${w}/${TEAMS[code].f}.png`;
  const flagImg = (code,w=40,cls='flagimg')=>`<img class="${cls}" src="${flagUrl(code,w)}" alt="${TEAMS[code].n}" loading="lazy" />`;
  /* 实力涨跌标签（基于 Elo 动态调整前后差值） */
  const deltaStr = c => {
    const d = Math.round((TEAMS[c].r - TEAMS[c].r0) * 10) / 10;
    if(d > 0.1) return `<span class="delta up">↑${d}</span>`;
    if(d < -0.1) return `<span class="delta down">↓${-d}</span>`;
    return '';
  };
  /* 泊松模型工具（比分概率热力图） */
  const ELO = r => 1500 + (r - 75) * 12;
  const poissonPmf = (k, l) => { if(l<=0) return k===0?1:0; let p=Math.exp(-l); for(let i=1;i<=k;i++) p*=l/i; return p; };
  const lambdas = (rh, ra, host) => {
    const base=1.35, sc=55, ha = host ? 1.12 : 1;
    let lh = base * (1 + (rh - ra) / sc) * ha;
    let la = base * (1 + (ra - rh) / sc);
    return [Math.max(0.25, Math.min(3.5, lh)), Math.max(0.2, Math.min(3.0, la))];
  };

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
    $('#champRating').innerHTML = `实力分 <b>${c.r.toFixed(1)}</b> ${deltaStr(CHAMP)} · 夺冠概率 <b>${c.oDyn}%</b>`;
    $('#champPath').textContent = CHAMPION_PATH.map(p=>`${p.round} ${p.score}`).join('  ›  ');

    $('#champVs').innerHTML = `
      <div class="vs-head">为何不是概率最高的西班牙？</div>
      <div class="vs-row"><span class="vs-tag">概率模型第一</span><span class="vs-team"><img src="${flagUrl('ESP',40)}" alt=""/>西班牙</span><b>${TEAMS.ESP.o.toFixed(1)}%</b></div>
      <div class="vs-row vs-row--hi"><span class="vs-tag vs-tag--gold">综合推演冠军</span><span class="vs-team"><img src="${flagUrl('FRA',40)}" alt=""/>法国</span><b>${c.oDyn}%</b></div>
      <div class="vs-note">Opta 概率模型西班牙居首；本站经赔率 + 决赛基因 + 动态状态加权推演法国夺冠。决赛 55:45 胶着。</div>`;

    $('#navMeta').innerHTML = `数据截至 ${META.updated}<br/>蒙特卡洛 ${META.monteCarlo.toLocaleString()} 次`;
    $('#footerMeta').innerHTML = `数据截至 <b style="color:var(--gold);font-family:var(--fm)">${META.updated}</b><br/>模型更新 ${META.modelUpdate}<br/>半衰期 ${META.halfLife}`;

    const stats = [
      {n:'48',u:'支',l:'参赛球队'},
      {n:'104',u:'场',l:'比赛场次'},
      {n:(META.monteCarlo/1000)+'K',u:'次',l:'蒙特卡洛模拟'},
      {n:TEAMS[CHAMP].oDyn,u:'%',l:`${TEAMS[CHAMP].n}夺冠概率`},
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
      .filter(t=>t.oDyn>=1.0)
      .sort((a,b)=>b.oDyn-a.oDyn);
    const max = ranked[0].oDyn;
    $('#powerList').innerHTML = ranked.map((t,i)=>`
      <div class="power-row reveal ${i<3?'is-top':''}">
        <div class="power-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="power-main">
          ${flagImg(t.c,80,'power-flag')}
          <div style="flex:1;min-width:0">
            <div class="power-name">${t.n}<small>${t.g}组 · ${t.r.toFixed(1)} ${deltaStr(t.c)}</small></div>
            <div class="power-bar"><div class="power-bar__fill" data-pct="${(t.oDyn/max*100).toFixed(1)}"></div></div>
          </div>
        </div>
        <div class="power-pct">${t.oDyn.toFixed(1)}%</div>
      </div>`).join('');
  }

  /* ============ 模型战绩（命中率） ============ */
  function calcAccuracy(){
    let total=0, hit=0, wlTotal=0, wlHit=0; const miss=[];
    const t={win:{h:0,t:0}, draw:{h:0,t:0}, loss:{h:0,t:0}};
    GROUPS.forEach(m=>{
      const [g,v,host,h,a,hs,as,played,pw,pd,pl]=m;
      if(played!==1) return;
      total++;
      const pred = (pw>=pd && pw>=pl) ? 'win' : (pl>=pd ? 'loss' : 'draw');
      const actual = hs>as ? 'win' : (hs<as ? 'loss' : 'draw');
      t[actual].t++;
      if(pred===actual){ hit++; t[actual].h++; }
      else miss.push({m, pred, actual});
      if(actual!=='draw'){ wlTotal++; if(pred===actual) wlHit++; }
    });
    return {total, hit, miss, t, wlTotal, wlHit};
  }

  function renderAccuracy(){
    const acc = calcAccuracy();
    const rate = acc.total ? (acc.hit/acc.total*100).toFixed(1) : '0.0';
    const label = {win:'主胜', draw:'平局', loss:'客胜'};
    const missHtml = acc.miss.map(x=>{
      const [g,v,host,h,a,hs,as]=x.m;
      return `<div class="acc-miss__item">
        <span class="acc-miss__flags">${flagImg(h,40)}${flagImg(a,40)}</span>
        <span class="acc-miss__match">${TEAMS[h].n} <b>${hs}-${as}</b> ${TEAMS[a].n}</span>
        <span class="acc-miss__pred">预测${label[x.pred]} · 实际${label[x.actual]}</span>
      </div>`;
    }).join('');
    $('#accuracyBody').innerHTML = `
      <div class="acc-hero reveal">
        <div class="acc-rate"><b>${rate}<i>%</i></b><small>命中率</small></div>
        <div class="acc-detail">
          <div class="acc-big"><b>${acc.hit}</b><span> / ${acc.total} 场已赛命中</span></div>
          <div class="acc-types">
            <span class="acc-type acc-type--w">胜负识别 <b>${acc.wlHit}/${acc.wlTotal}</b> · ${acc.wlTotal?(acc.wlHit/acc.wlTotal*100).toFixed(0):0}%</span>
            <span class="acc-type acc-type--d">平局 <b>${acc.t.draw.h}/${acc.t.draw.t}</b> · 公认难点</span>
          </div>
        </div>
      </div>
      ${acc.miss.length ? `<div class="acc-miss reveal">
        <div class="acc-miss__head">预测偏差 · ${acc.miss.length} 场（以平局爆冷为主，足球预测公认难点）</div>
        <div class="acc-miss__list">${missHtml}</div>
      </div>` : ''}`;
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

  function matchCard(m, idx){
    const [g,v,h_,h,a,hs,as,played,pw,pd,pl,ts] = m;
    const hostMark = h_ ? 'home-host' : '';
    const scoreCls = played ? 'done' : 'pred';
    const statusTag = played ? '<i class="m-status m-done">已完</i>' : '<i class="m-status m-pred">预测</i>';
    const score = `<span>${hs}</span><span class="dash">:</span><span>${as}</span>${statusTag}`;
    const tops = ts.slice(0,3).map(s=>`<b>${s[0]}</b> ${s[1]}%`).join(' · ');
    return `<div class="match" data-idx="${idx}" onclick="location.hash='/match/'+${idx}" title="点击查看深度解析">
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
        <div class="matches">${ms.map(mm=>matchCard(mm, GROUPS.indexOf(mm))).join('')}</div>
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
          <div class="profile__rating"><b>${TEAMS[p.c].r.toFixed(1)}</b><small>${deltaStr(p.c)} · ${p.odds}</small></div>
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

  /* ============ 主题切换 ============ */
  function setupTheme(){
    const btn = $('#themeBtn'); if(!btn) return;
    const root = document.documentElement;
    const sync = ()=> btn.textContent = root.getAttribute('data-theme')==='light' ? '☀' : '☾';
    sync();
    btn.addEventListener('click', ()=>{
      const next = root.getAttribute('data-theme')==='light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('wc-theme', next);
      sync();
    });
  }

  /* ============ 实时赛果加载（覆盖内置比分） ============ */
  async function loadResults(){
    try{
      const res = await fetch('assets/data/results.json?t=' + Date.now());
      if(!res.ok) return;
      const data = await res.json();
      const map = {};
      data.forEach(r => { if(r.played === 1) map[r.h + '_' + r.a] = r; });
      let n = 0;
      GROUPS.forEach(m => {
        const r = map[m[3] + '_' + m[4]];
        if(r){ m[5] = r.hs; m[6] = r.as; m[7] = 1; n++; }
      });
      if(n) console.log(`✓ 实时赛果已合并 ${n} 场`);
    }catch(e){ console.warn('results.json 未加载，使用内置数据'); }
  }

  /* ============ 动态 Elo 实力调整（爆冷自适应） ============
     每场已赛后按"实际 vs 预期"更新两队实力分；爆冷（弱胜强）大幅调整，
     大比分放大。连锁：实力分变 → 夺冠概率重算 → 概率榜/档案随之更新。 */
  function applyElo(){
    const K = 6, C = 60;
    const expect = (Ra, Rb) => 1 / (1 + Math.pow(10, (Rb - Ra) / C));
    GROUPS.forEach(m => {
      const [g, v, host, h, a, hs, as, played] = m;
      if(played !== 1) return;
      const Ra = TEAMS[h].r, Rb = TEAMS[a].r;
      const Ea = expect(Ra, Rb);
      const Sa = hs > as ? 1 : (hs < as ? 0 : 0.5);
      const gd = Math.abs(hs - as);
      const mu = gd >= 3 ? 1.3 : (gd === 2 ? 1.1 : 1);
      const d = K * mu * (Sa - Ea);
      TEAMS[h].r = Math.round((Ra + d) * 10) / 10;
      TEAMS[a].r = Math.round((Rb - d) * 10) / 10;
    });
  }

  /* 夺冠概率：Opta 先验 + 实力涨跌微调，归一化保持总盘 */
  function recomputeOdds(){
    const optaSum = Object.values(TEAMS).reduce((s, t) => s + t.o, 0);
    const w = 0.025;
    const rawSum = Object.values(TEAMS).reduce((s, t) => s + t.o * (1 + (t.r - t.r0) * w), 0);
    Object.keys(TEAMS).forEach(c => {
      const t = TEAMS[c];
      t.oDyn = +(t.o * (1 + (t.r - t.r0) * w) / rawSum * optaSum).toFixed(1);
    });
  }

  /* ============ 单场详情（深度解析） ============ */
  function renderMatch(idx){
    const m = GROUPS[idx];
    if(!m){ location.hash=''; return; }
    const [g,v,host,h,a,hs,as,played,pw,pd,pl,ts] = m;
    const th=TEAMS[h], ta=TEAMS[a];
    const [lh,la]=lambdas(th.r,ta.r,host);
    const N=7;
    const mat=[];
    for(let i=0;i<N;i++){mat[i]=[];for(let j=0;j<N;j++)mat[i][j]=poissonPmf(i,lh)*poissonPmf(j,la)*100;}
    let under=0;
    for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(i+j<=2)under+=mat[i][j];
    const over=100-under;
    const flat=[];
    for(let i=0;i<N;i++)for(let j=0;j<N;j++)flat.push({s:i+'-'+j,p:mat[i][j],i,j});
    flat.sort((x,y)=>y.p-x.p);
    const top5=flat.slice(0,5);
    let head='<tr><th></th>'; for(let j=0;j<N;j++) head+=`<th>${j}</th>`; head+='</tr>';
    let rows='';
    for(let i=0;i<N;i++){
      let cells=`<th>${i}</th>`;
      for(let j=0;j<N;j++){
        const p=mat[i][j];
        const actual=played&&i===hs&&j===as;
        const op=Math.min(1,p/12);
        cells+=`<td class="hm-cell ${actual?'hm-actual':''}" style="background:rgba(232,179,57,${(op*0.75).toFixed(2)})">${p>=1?p.toFixed(1):'<i>·</i>'}</td>`;
      }
      rows+=`<tr>${cells}</tr>`;
    }
    const eh=ELO(th.r), ea=ELO(ta.r);
    const winnerName = pw>=pd&&pw>=pl?th.n:(pl>=pd?ta.n:'平局');
    const maxP=Math.max(pw,pd,pl);
    let actualNote='';
    if(played){
      const topHit=hs===top5[0].i&&as===top5[0].j;
      const dirHit=(hs>as&&top5[0].i>top5[0].j)||(hs<as&&top5[0].i<top5[0].j)||(hs===as&&top5[0].i===top5[0].j);
      actualNote=topHit?'，实际比分完美命中！':(dirHit?`，实际 ${hs}-${as}（胜负方向命中）`:`，实际 ${hs}-${as}（爆冷偏差）`);
    }
    $('#matchViewTitle').textContent = `${th.n} vs ${ta.n}`;
    $('#matchBody').innerHTML = `
      <div class="mv-head">
        <div class="mv-meta">${g}组 · ${v}${host?' · 主场':''} · ${played?'已完赛':'未赛（预测）'}</div>
        <div class="mv-scoreboard">
          <div class="mv-team"><div class="mv-flag">${flagImg(h,160)}</div><div class="mv-name">${th.n}${host?'<i class="mv-host">🏠主场</i>':''}</div><div class="mv-elo">Elo ${eh} · ${th.r.toFixed(1)} ${deltaStr(h)}</div></div>
          <div class="mv-score ${played?'done':'pred'}">${played?`${hs}<span>:</span>${as}`:'<small>未赛</small>'}</div>
          <div class="mv-team"><div class="mv-flag">${flagImg(a,160)}</div><div class="mv-name">${ta.n}</div><div class="mv-elo">Elo ${ea} · ${ta.r.toFixed(1)} ${deltaStr(a)}</div></div>
        </div>
      </div>
      <div class="mv-grid">
        <div class="mv-card">
          <h3>三态概率 <small>融合模型</small></h3>
          <div class="tri-bar"><div class="tri tri-w" style="width:${pw}%">${th.n}胜 ${pw}%</div><div class="tri tri-d" style="width:${pd}%">平 ${pd}%</div><div class="tri tri-l" style="width:${pl}%">${ta.n}胜 ${pl}%</div></div>
          <div class="mv-xg">期望进球 <b>${lh.toFixed(2)}</b> : <b>${la.toFixed(2)}</b> ｜ 总进球 >2.5：<b>${over.toFixed(0)}%</b></div>
        </div>
        <div class="mv-card">
          <h3>最可能比分 Top 5 <small>泊松模型</small></h3>
          <div class="mv-top5">${top5.map(t=>`<span class="topscore ${played&&t.i===hs&&t.j===as?'hit':''}"><b>${t.s}</b><i>${t.p.toFixed(1)}%</i></span>`).join('')}</div>
        </div>
      </div>
      <div class="mv-card">
        <h3>比分概率热力图</h3>
        <div class="mv-heat-legend">行 = ${th.n}进球 ｜ 列 = ${ta.n}进球 ｜ 单元格 = 该比分概率%${played?' ｜ 绿框 = 实际比分':''}</div>
        <div class="mv-heat-wrap"><table class="hm-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
      </div>
      <div class="mv-card mv-read">
        <h3>🤖 模型解读</h3>
        <div class="mv-row"><span class="mv-label">⚖️ 实力对比</span><div>${eh>ea?th.n:ta.n}占优：${th.n} ${eh} vs ${ta.n} ${ea}，差距 ${Math.abs(eh-ea)} 分</div></div>
        <div class="mv-row"><span class="mv-label">📈 近期状态</span><div>${th.n} ${th.r>th.r0?`<b class="up">强势 ↑${(th.r-th.r0).toFixed(1)}</b>`:'平稳'}；${ta.n} ${ta.r>ta.r0?`<b class="up">强势 ↑${(ta.r-ta.r0).toFixed(1)}</b>`:ta.r<ta.r0?`<b class="down">走低 ↓${(ta.r0-ta.r).toFixed(1)}</b>`:'平稳'}（基于已赛 Elo）</div></div>
        <div class="mv-row"><span class="mv-label">⚽ 攻防期望</span><div>期望进球 ${th.n} <b>${lh.toFixed(2)}</b> vs ${ta.n} <b>${la.toFixed(2)}</b>（${host?`${th.n}主场 ×1.12`:'中立场'}）</div></div>
        <div class="mv-row"><span class="mv-label">🎯 综合结论</span><div>模型认为 <b>${winnerName}</b> 概率最高（${maxP}%），最可能比分 <b>${top5[0].s}</b>（${top5[0].p.toFixed(1)}%）${actualNote}。</div></div>
      </div>
      <div class="mv-note">※ 热力图与期望进球由泊松模型实时计算（两队实力 + 主场优势）；近期状态基于 Elo 动态调整。历史交锋与近 10 场明细可后续接入 ESPN 补全。</div>
    `;
    $('#matchView').hidden=false;
    document.body.style.overflow='hidden';
    window.scrollTo(0,0);
  }
  function closeMatch(){ $('#matchView').hidden=true; document.body.style.overflow=''; }
  function router(){
    const m=location.hash.match(/match\/(\d+)/);
    if(m) renderMatch(+m[1]);
    else if($('#matchView')&&!$('#matchView').hidden) closeMatch();
  }

  /* ============ 启动 ============ */
  async function init(){
    await loadResults();
    applyElo();
    recomputeOdds();
    renderHero();
    renderPower();
    renderGroups();
    renderBracket();
    renderPath();
    renderProfiles();
    renderMethod();
    renderAccuracy();
    observeReveal();
    setupTheme();
    window.addEventListener('hashchange', router);
    router();
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
