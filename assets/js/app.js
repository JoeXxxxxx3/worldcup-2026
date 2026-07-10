/* ============================================================
   2026 世界杯预言 — 渲染层
   ============================================================ */
(function(){
  const { META, TEAMS, GROUPS, KNOCKOUT, CHAMPION_PATH, PROFILES, FIFA_RANK, STARS, PLAYER_AWARDS, H2H } = window.WC;
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
  const ELO = r => Math.round(1500 + (r - 75) * 12);   // Elo 取整显示（多位小数难看）
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
  /* 冠军之路高亮：优先用动态推演冠军，否则综合推演冠军 */
  const CHAMP = META.champion;
  let dynamicKO = null;
  const getChampion = ()=> (dynamicKO && dynamicKO.final[0] && dynamicKO.final[0].w) || CHAMP;
  const onChampPath = (h,a)=> { const c=getChampion(); return h===c||a===c; };
  /* 从 dynamicKO 提取冠军的真实/推演路径（各轮对手 + 比分），取代硬编码 CHAMPION_PATH */
  function buildChampionPath(c){
    if(!c || !dynamicKO) return [];
    const rounds=[['32强','r32'],['16强','r16'],['8强','qf'],['半决赛','sf']];
    const path=[];
    for(const [round,key] of rounds){
      const m=(dynamicKO[key]||[]).find(x=>x&&(x.h===c||x.a===c));
      if(m){
        const opp=m.h===c?m.a:m.h;
        const cg=m.h===c?m.hs:m.as, og=m.h===c?m.as:m.hs;
        path.push({round,opp:TEAMS[opp].n,code:opp,score:`${cg}-${og}`,real:!!m.real});
      }
    }
    const f=dynamicKO.final&&dynamicKO.final[0];
    if(f&&(f.h===c||f.a===c)){
      const opp=f.h===c?f.a:f.h;
      const cg=f.h===c?f.hs:f.as, og=f.h===c?f.as:f.hs;
      path.push({round:'决赛',opp:TEAMS[opp].n,code:opp,score:`${cg}-${og}`,real:!!f.real});
    }
    return path;
  }
  /* 已淘汰队：淘汰赛败者 + 小组赛未进 32 强（用于夺冠概率榜标注） */
  function getEliminated(){
    const elim=new Set();
    if(dynamicKO){
      [dynamicKO.r32,dynamicKO.r16,dynamicKO.qf,dynamicKO.sf].forEach(arr=>(arr||[]).forEach(m=>{
        if(m && m.real){ elim.add(m.w===m.h ? m.a : m.h); }
      }));
    }
    // 小组赛出局：未进 32 强赛事的参赛队（如乌拉圭 H 组第3）
    const r32=new Set();
    (koSchedule||[]).filter(x=>x.round==='32强').forEach(x=>{r32.add(x.h);r32.add(x.a);});
    if(r32.size) Object.keys(TEAMS).forEach(c=>{ if(!r32.has(c)) elim.add(c); });
    return elim;
  }

  /* ============ 1. 冠军卡 & 顶部数据 ============ */
  function renderHero(){
    const c = TEAMS[CHAMP];
    $('#champFlag').src = flagUrl(CHAMP,160);
    $('#champName').textContent = c.n;
    $('#champRating').innerHTML = `实力分 <b>${c.r.toFixed(1)}</b> ${deltaStr(CHAMP)} · 夺冠概率 <b>${c.oDyn}%</b>`;
    const cpath = buildChampionPath(getChampion());
    $('#champPath').textContent = (cpath.length?cpath:CHAMPION_PATH).map(p=>`${p.round} ${p.score}`).join('  ›  ');

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
    // 已淘汰队概率归零，存活队按原比例重新归一化（反映淘汰后形势），再重排（淘汰队沉底）
    const elim = getEliminated();
    const aliveSum = ranked.filter(t=>!elim.has(t.c)).reduce((s,t)=>s+t.oDyn,0) || 1;
    const adj = ranked.map(t=>({...t, oDynAdj: elim.has(t.c)?0:+(t.oDyn/aliveSum*100).toFixed(1)}));
    const sorted = adj.slice().sort((a,b)=>b.oDynAdj-a.oDynAdj);
    const max = sorted[0].oDynAdj || 1;
    $('#powerList').innerHTML = sorted.map((t,i)=>{
      const out = elim.has(t.c);
      return `
      <div class="power-row reveal ${i<3 && !out?'is-top':''} ${out?'is-out':''}" data-team="${t.c}" role="button" tabindex="0" aria-label="${t.n}实力档案">
        <div class="power-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="power-main">
          ${flagImg(t.c,80,'power-flag')}
          <div style="flex:1;min-width:0">
            <div class="power-name">${t.n}${out?'<i class="pw-out">已淘汰</i>':''}<small>${t.g}组 · ${t.r.toFixed(1)} ${deltaStr(t.c)}</small></div>
            <div class="power-bar"><div class="power-bar__fill" data-pct="${(t.oDynAdj/max*100).toFixed(1)}"></div></div>
          </div>
        </div>
        <div class="power-pct">${out?'—':t.oDynAdj+'%'}</div>
      </div>
      <div class="power-detail" data-for="${t.c}" hidden></div>`;
    }).join('');
    $$('#powerList .power-row').forEach(r=>{
      r.addEventListener('click',()=>toggleTeam(r.dataset.team,r));
      r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleTeam(r.dataset.team,r);}});
    });
  }

  /* ============ 球员榜（金靴 / 助攻） ============ */
  function renderPlayerAwards(){
    const row = (p,i,unit)=>`<div class="pa-row"><span class="pa-rank">${i+1}</span><span class="pa-flag">${flagImg(p.c,40,'')}</span><div class="pa-info"><b>${p.n}</b><small>${p.t}${p.club?' · '+p.club:''}</small></div><span class="pa-stat">${unit==='g'?p.g:p.a}<i>${unit==='g'?'球':'助'}</i></span></div>`;
    $('#paDate').textContent = PLAYER_AWARDS.updated;
    $('#paWrap').innerHTML = `
      <div class="pa-card">
        <h3>👟 金靴榜 <small>TOP SCORERS</small></h3>
        ${PLAYER_AWARDS.scorers.map((p,i)=>row(p,i,'g')).join('')}
      </div>
      <div class="pa-card">
        <h3>🎯 助攻榜 <small>ASSISTS</small></h3>
        ${PLAYER_AWARDS.assists.map((p,i)=>row(p,i,'a')).join('')}
      </div>
    `;
  }

  /* ============ 爆冷榜（以弱胜强 / 软柿子） ============ */
  let upsetSort='mag';   // 'mag' 按爆冷指数 | 'count' 按爆冷次数（用户可切换）
  function calcUpsets(){
    const upsets=[],winCount={},loseCount={},winMag={},strongMag={};
    const weakWin={},weakDraw={},strongLost={},strongDrawn={};
    GROUPS.forEach(m=>{
      if(m[7]!==1)return;
      const h=m[3],a=m[4],hs=m[5],as=m[6];
      if(!TEAMS[h]||!TEAMS[a])return;
      const rh=TEAMS[h].r, ra=TEAMS[a].r;
      const weak=rh<ra?h:a, strong=rh<ra?a:h;
      const diff=TEAMS[strong].r-TEAMS[weak].r;
      if(diff<=0.5)return;                       // 实力接近(差≤0.5)不算爆冷
      const ws=weak===h?hs:as, ss=weak===h?as:hs; // 弱队进球 / 强队进球
      let mag=0,type='';
      if(ws>ss){mag=diff;type='胜';}             // 弱胜强：满冷门值
      else if(ws===ss){mag=diff*0.5;type='平';}  // 弱平强：半冷门值
      else return;                                // 弱负：正常
      upsets.push({weak,strong,diff,mag,type});
      winCount[weak]=(winCount[weak]||0)+1;
      winMag[weak]=(winMag[weak]||0)+mag;          // 弱队爆冷指数
      strongMag[strong]=(strongMag[strong]||0)+mag; // 强队被爆冷指数
      loseCount[strong]=(loseCount[strong]||0)+1;
      if(type==='胜'){weakWin[weak]=(weakWin[weak]||0)+1;strongLost[strong]=(strongLost[strong]||0)+1;}
      else{weakDraw[weak]=(weakDraw[weak]||0)+1;strongDrawn[strong]=(strongDrawn[strong]||0)+1;}
    });
    return {upsets,winCount,loseCount,winMag,strongMag,weakWin,weakDraw,strongLost,strongDrawn};
  }
  function renderUpsets(){
    const {upsets,winCount,loseCount,winMag,strongMag,weakWin,weakDraw,strongLost,strongDrawn}=calcUpsets();
    if(!upsets.length){ $('#upsetsBody').innerHTML='<div class="upsets-empty">暂无爆冷——已赛场次中强队悉数守住阵地。</div>'; return; }
    const byMag=upsetSort==='mag';
    const winSort=(a,b)=>byMag?((winMag[b[0]]||0)-(winMag[a[0]]||0)):((b[1]-a[1])||((winMag[b[0]]||0)-(winMag[a[0]]||0)));
    const loseSort=(a,b)=>byMag?((strongMag[b[0]]||0)-(strongMag[a[0]]||0)):((b[1]-a[1])||((strongMag[b[0]]||0)-(strongMag[a[0]]||0)));
    const winners=Object.entries(winCount).sort(winSort).slice(0,8);
    const losers=Object.entries(loseCount).sort(loseSort).slice(0,8);
    const biggest=upsets.slice().sort((a,b)=>b.mag-a.mag).slice(0,5);
    const sLabel=byMag?'按爆冷指数↓':'按爆冷次数↓';
    const wRow=([c,n])=>{
      const p=[];
      if(weakWin[c])p.push(`拿下 <b class="up-i-win">${weakWin[c]}</b>`);
      if(weakDraw[c])p.push(`逼平 <b class="up-i-draw">${weakDraw[c]}</b>`);
      const badge=byMag?(winMag[c]||0).toFixed(0):n;
      return `<div class="up-row"><span class="up-flag">${flagImg(c,40,'')}</span><div class="up-info"><b>${TEAMS[c].n}</b><small>${p.join(' · ')} · 指数 ${(winMag[c]||0).toFixed(1)}</small></div><span class="up-badge up-badge--w">${badge}</span></div>`;
    };
    const lRow=([c,n])=>{
      const p=[];
      if(strongLost[c])p.push(`被拿下 <b class="up-i-win">${strongLost[c]}</b>`);
      if(strongDrawn[c])p.push(`被逼平 <b class="up-i-draw">${strongDrawn[c]}</b>`);
      const badge=byMag?(strongMag[c]||0).toFixed(0):n;
      return `<div class="up-row"><span class="up-flag">${flagImg(c,40,'')}</span><div class="up-info"><b>${TEAMS[c].n}</b><small>${p.join(' · ')} · 纸面 ${TEAMS[c].r.toFixed(1)}</small></div><span class="up-badge up-badge--l">${badge}</span></div>`;
    };
    $('#upsetsBody').innerHTML=`
      <div class="up-card">
        <h3>🦷 爆冷王 <small>弱队 · ${sLabel}</small></h3>
        ${winners.map(wRow).join('')||'<div class="up-empty">暂无</div>'}
      </div>
      <div class="up-card">
        <h3>🐯 软柿子 <small>强队 · ${sLabel}</small></h3>
        ${losers.map(lRow).join('')||'<div class="up-empty">暂无</div>'}
      </div>
      <div class="up-card up-card--wide">
        <h3>💥 本届最大冷门 <small>弱队爆冷胜/平 排行</small></h3>
        ${biggest.map((u,i)=>`<div class="up-cold"><span class="up-cold__rank">${i+1}</span><span class="up-flag">${flagImg(u.weak,40,'')}</span><div class="up-cold__main"><b>${TEAMS[u.weak].n}</b> ${TEAMS[u.weak].r.toFixed(0)} <span class="up-cold__beat">爆冷${u.type}</span> <b>${TEAMS[u.strong].n}</b> ${TEAMS[u.strong].r.toFixed(0)}</div><span class="up-cold__diff ${u.type==='平'?'is-draw':''}">差 +${u.diff.toFixed(1)}${u.type==='平'?'·平':''}</span></div>`).join('')}
      </div>
    `;
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

  /* ============ 赛果焦点（小组赛 / 淘汰赛 双模块） ============
     淘汰赛模块 = 淘汰赛的单场「聚焦放大」视图（信息更全：Elo / xG / Top 比分），
     采用原生横向滚动 + scroll-snap，手感与淘汰赛 bracket 一致（momentum + 吸附）。
     默认滚到最新一场，左右滑 / 点箭头浏览；淘汰赛板块本身则是全局一览。 */
  let focusTab = 'group';        // 'group' | 'ko'，init 时按赛程阶段选默认
  let focusScrollIdx = -1;       // 用户当前浏览位置（-1 → 回到最新）
  let koSchedule=[];
  /* 通用预测：Elo + 泊松 → 三态概率 + 期望进球 + Top 比分 + Elo 分（淘汰赛深度卡用） */
  function predictMatch(h, a, host=0){
    if(!TEAMS[h]||!TEAMS[a]) return null;
    const th=TEAMS[h],ta=TEAMS[a];
    const [lh,la]=lambdas(th.r,ta.r,host);
    const N=7, mat=[];
    for(let i=0;i<N;i++){mat[i]=[];for(let j=0;j<N;j++)mat[i][j]=poissonPmf(i,lh)*poissonPmf(j,la)*100;}
    let pw=0,pd=0,pl=0;
    for(let i=0;i<N;i++)for(let j=0;j<N;j++){ if(i>j)pw+=mat[i][j]; else if(i===j)pd+=mat[i][j]; else pl+=mat[i][j]; }
    const flat=[]; for(let i=0;i<N;i++)for(let j=0;j<N;j++) flat.push([i+'-'+j,mat[i][j]]);
    flat.sort((x,y)=>y[1]-x[1]);
    return {pw:Math.round(pw),pd:Math.round(pd),pl:Math.round(pl),
      top:flat.slice(0,3).map(x=>[x[0],+x[1].toFixed(1)]),
      lh:+lh.toFixed(2), la:+la.toFixed(2), eh:ELO(th.r), ea:ELO(ta.r)};
  }
  /* 标准化：GROUPS 场次 / 淘汰赛赛程项 → 统一卡片结构 */
  function normGroup(m){
    const [g,v,host,h,a,hs,as,played,pw,pd,pl,ts]=m;
    return {h,a,hs,as,host,played:played===1,ko:false,round:g+'组',venue:v,date:'',time:'',pw,pd,pl,ts:ts||[]};
  }
  function normKO(x){
    const p=predictMatch(x.h,x.a,0)||{pw:0,pd:0,pl:0,top:[]};
    return {h:x.h,a:x.a,hs:x.hs,as:x.as,host:0,played:x.state==='post',ko:true,
      round:x.round||'淘汰赛',venue:'',date:x.d||'',time:x.t||'',
      pw:p.pw,pd:p.pd,pl:p.pl,ts:p.top,lh:p.lh,la:p.la,eh:p.eh,ea:p.ea};
  }
  function focusList(){ return focusTab==='ko' ? koSchedule.map(normKO) : GROUPS.map(normGroup); }
  function focusBaseIdx(){
    const L=focusList(); let last=-1;
    L.forEach((m,i)=>{ if(m.played) last=i; });
    return last>=0?last:0;
  }
  function focusPosHTML(m, i, total, base){
    const atLatest = i===base;
    return `${atLatest?'<b class="fp-live">● 最新赛果</b> · ':'近期 · '}第 ${i+1} / ${total} 场 · ${m.played?'已完赛复盘':'未赛预告'}${m.date?` · ${m.date}${m.time?' '+m.time:''}`:''} · 左右滑动 / 点箭头切换`;
  }
  function renderAccuracy(){
    const acc = calcAccuracy();
    const rate = acc.total ? (acc.hit/acc.total*100).toFixed(1) : '0.0';
    const L=focusList();
    const total = L.length || 1;
    const base = focusBaseIdx();
    const startIdx = focusScrollIdx>=0 && focusScrollIdx<total ? focusScrollIdx : base;
    const koPost = koSchedule.filter(x=>x.state==='post').length;
    const tabHTML = `<div class="focus-tabs">
        <button class="focus-tab ${focusTab==='group'?'active':''}" data-tab="group">小组赛</button>
        <button class="focus-tab ${focusTab==='ko'?'active':''}" data-tab="ko">淘汰赛${koSchedule.length?` · 已赛 ${koPost}`:''}</button>
      </div>`;
    $('#accuracyBody').innerHTML = `
      ${tabHTML}
      <div class="acc-stats reveal">
        <div class="acc-stat is-main"><b>${rate}<i>%</i></b><small>模型命中率</small></div>
        <div class="acc-stat"><b>${acc.hit}<i>/</i>${acc.total}</b><small>命中场次</small></div>
        <div class="acc-stat"><b>${acc.wlHit}<i>/</i>${acc.wlTotal}</b><small>胜负识别</small></div>
        <div class="acc-stat"><b>${acc.t.draw.h}<i>/</i>${acc.t.draw.t}</b><small>平局命中</small></div>
      </div>
      <div class="focus-stage">
        <button class="focus-nav" data-dir="-1" aria-label="上一场">‹</button>
        <div class="focus-scroll" id="focusScroll">
          ${L.map((m,i)=>`<div class="focus-slide${i===base?' is-latest':''}" data-i="${i}">${focusCard(m)}</div>`).join('')}
        </div>
        <button class="focus-nav" data-dir="1" aria-label="下一场">›</button>
      </div>
      <div class="focus-pos" id="focusPos">${focusPosHTML(L[startIdx]||L[0], startIdx, total, base)}</div>`;
    // 默认滚到最新 / 记忆位置；滑动时实时更新底部文案并隐藏箭头
    const sc=$('#focusScroll');
    if(sc){
      sc.scrollLeft = startIdx * sc.offsetWidth;
      let t=null;
      sc.addEventListener('scroll', ()=>{
        const idx=Math.max(0,Math.min(total-1, Math.round(sc.scrollLeft/(sc.offsetWidth||1))));
        focusScrollIdx = idx;
        const pos=$('#focusPos'); if(pos) pos.innerHTML=focusPosHTML(L[idx], idx, total, base);
        const st=sc.closest('.focus-stage'); if(st) st.classList.add('sliding');
        clearTimeout(t); t=setTimeout(()=>{ if(st) st.classList.remove('sliding'); }, 220);
      }, {passive:true});
    }
    // 动态重渲染产生的 .reveal 是全新节点，IntersectionObserver 只 observe 一次 → 手动补 .in
    $$('#accuracyBody .reveal').forEach(el=>el.classList.add('in'));
  }
  /* 球队本届小组赛战绩（已赛场统计：胜/平/负、进球/失球） */
  function teamForm(code){
    const f={w:0,d:0,l:0,gf:0,ga:0};
    GROUPS.forEach(m=>{ if(m[7]!==1) return;
      if(m[3]===code){f.gf+=m[5];f.ga+=m[6];m[5]>m[6]?f.w++:m[5]<m[6]?f.l++:f.d++;}
      else if(m[4]===code){f.gf+=m[6];f.ga+=m[5];m[6]>m[5]?f.w++:m[6]<m[5]?f.l++:f.d++;}
    });
    return f;
  }
  function focusCard(m){
    const {h,a,hs,as,host,played,ko,round,venue,date,time,ts,pw,pd,pl,lh,la,eh,ea}=m;
    const th=TEAMS[h],ta=TEAMS[a];
    const pred=pw>=pd&&pw>=pl?'win':(pl>=pd?'loss':'draw');
    // 命中徽章
    let badge='<span class="fc-badge live">未赛</span>', hit=true, aTxt='';
    if(played){
      const actual=hs>as?'win':(hs<as?'loss':'draw');
      hit=pred===actual;
      aTxt=actual==='win'?`${th.n}胜`:actual==='loss'?`${ta.n}胜`:'平局';
      badge=`<span class="fc-badge ${hit?'ok':'no'}">${hit?'✓ 预测命中':'✕ 预测未中'}</span>`;
    }
    // Elo / xG 对比条左队占比
    const eloPct=(eh+ea)?Math.round(eh/(eh+ea)*100):50;
    const xgPct=(lh+la)?Math.round(lh/(lh+la)*100):50;
    const meta=`${round}${date?` · ${date}${time?' '+time:''}`:''}${venue?' · '+venue:''}`;
    // 三态彩色比例条
    const bar=`<div class="fc-3bar"><div class="fc-3w" style="flex:${pw}"></div><div class="fc-3d" style="flex:${pd}"></div><div class="fc-3l" style="flex:${pl}"></div></div>`;
    const barLbl=`<div class="fc-3lbl"><span>${th.n}胜 <b>${pw}%</b></span><span>平 <b>${pd}%</b></span><span>${ta.n}胜 <b>${pl}%</b></span></div>`;
    // 深度对比（淘汰赛）
    const deep=ko?`<div class="fc-cmp">
        <div class="fc-cmp-row"><b class="fc-cmp-l">${eh}</b><div class="fc-cmp-mid"><small>Elo 实力</small><div class="fc-cmp-track"><i style="width:${eloPct}%"></i></div></div><b class="fc-cmp-r">${ea}</b></div>
        <div class="fc-cmp-row"><b class="fc-cmp-l">${lh.toFixed(2)}</b><div class="fc-cmp-mid"><small>期望进球 xG</small><div class="fc-cmp-track"><i style="width:${xgPct}%"></i></div></div><b class="fc-cmp-r">${la.toFixed(2)}</b></div>
      </div>`:'';
    // Top 比分药丸
    const pills=(ts&&ts.length)?`<div class="fc-pills"><small>最可能比分</small>${ts.slice(0,3).map(x=>`<span class="fc-pill"><b>${x[0]}</b><em>${x[1]}%</em></span>`).join('')}</div>`:'';
    // 爆冷风险（未赛）
    const weak=th.r<ta.r?h:a;
    const ur=Math.min((weak===h?pw:pl)+pd,99);
    const upset=(!played&&ur>=25)?`<div class="fc-upset">${ur>=40?'🔥 高爆冷风险':'⚠️ 冷门可能'}</div>`:'';
    const actLn=(played&&!hit)?`<div class="fc-actln">实际：<b>${aTxt} ${hs}-${as}</b></div>`:'';
    const fh=teamForm(h),ffa=teamForm(a);
    const fmt=f=>`${f.w}胜${f.d}平${f.l}负`;
    const frk=c=>FIFA_RANK[c]?`FIFA 第${FIFA_RANK[c]}`:'';
    return `<div class="fc-card">
      <div class="fc-top"><span class="fc-meta">${meta}</span>${badge}</div>
      <div class="fc-body">
        <div class="fc-left">
          <div class="fc-match">
            <div class="fc-side fc-side--l"><span class="fc-flag">${flagImg(h,80)}</span><b>${th.n}</b>${host?'<i>主</i>':''}</div>
            <div class="fc-sc">${played?`<b>${hs}</b><i>:</i><b>${as}</b>`:'<small>VS</small>'}</div>
            <div class="fc-side fc-side--r"><b>${ta.n}</b><span class="fc-flag">${flagImg(a,80)}</span></div>
          </div>
          ${upset}
          <div class="fc-form">
            <div class="fc-form-t"><span class="fc-flag">${flagImg(h,40)}</span><div><b>${th.n}</b><small>${fmt(fh)}${frk(h)?` · ${frk(h)}`:''}</small></div></div>
            <div class="fc-form-t"><span class="fc-flag">${flagImg(a,40)}</span><div><b>${ta.n}</b><small>${fmt(ffa)}${frk(a)?` · ${frk(a)}`:''}</small></div></div>
          </div>
        </div>
        <div class="fc-right">
          ${bar}${barLbl}${deep}${pills}${actLn}
        </div>
      </div>
    </div>`;
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
  /* 基于「已赛」判断每队是否已锁定出线/出局：枚举未赛所有胜负平组合，
     若该队所有组合都前2 → in(锁定出线)；都进不了前2 → out(锁定出局)；否则 maybe */
  /* 12 组第 3 名按积分/净胜球/进球排序，前 8 出线（48 队赛制：前2 + 8 最佳第三） */
  function calcBestThirds(){
    const thirds=[];
    'ABCDEFGHIJKL'.split('').forEach(g=>{
      const ms=GROUPS.filter(m=>m[0]===g);
      const played=ms.filter(m=>m[7]===1);
      if(played.length < ms.length) return;   // 该组未全完赛则跳过
      const st=calcStandings(played);
      if(st[2]) thirds.push(st[2]);
    });
    thirds.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
    return new Set(thirds.slice(0,8).map(t=>t.c));
  }
  function qualifyStatus(g){
    const ms = GROUPS.filter(m=>m[0]===g);
    const teams = [...new Set(ms.flatMap(m=>[m[3],m[4]]))];
    const played = ms.filter(m=>m[7]===1);
    if(!played.length) return {};
    // 该组已全完赛 → 实际排名 + 最佳第三判断
    if(played.length >= ms.length){
      const st = calcStandings(played);
      const bestThirds = calcBestThirds();
      const out = {};
      st.forEach((t,i)=>{
        if(i<2) out[t.c]='in';
        else if(i===2) out[t.c] = bestThirds.has(t.c) ? 'in' : 'out';
        else out[t.c]='out';
      });
      return out;
    }
    // 未全完赛 → 枚举未赛判断前2
    const unplayed = ms.filter(m=>m[7]!==1);
    const base = {}; teams.forEach(c=>base[c]=0);
    played.forEach(m=>{ const hs=m[5],as=m[6]; if(hs>as)base[m[3]]+=3; else if(hs<as)base[m[4]]+=3; else{base[m[3]]++;base[m[4]]++;} });
    let combos=[[]];
    unplayed.forEach(()=>{ const n=[]; ['h','d','a'].forEach(r=>combos.forEach(c=>n.push([...c,r]))); combos=n; });
    if(combos.length>3000) return {}; // 组合过多（开赛初期未赛多）跳过，避免卡顿
    const worst={},best={}; teams.forEach(c=>{worst[c]=0;best[c]=99;});
    combos.forEach(combo=>{
      const pts={...base};
      unplayed.forEach((m,i)=>{ const r=combo[i]; if(r==='h')pts[m[3]]+=3; else if(r==='a')pts[m[4]]+=3; else{pts[m[3]]++;pts[m[4]]++;} });
      const ranked=[...teams].sort((a,b)=>pts[b]-pts[a]);
      teams.forEach(c=>{ const rk=ranked.indexOf(c)+1; if(rk>worst[c])worst[c]=rk; if(rk<best[c])best[c]=rk; });
    });
    const st={}; teams.forEach(c=>{ st[c]=worst[c]<=2?'in':(best[c]>2?'out':'maybe'); });
    return st;
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
      const playedMs = ms.filter(m=>m[7]===1);
      const realStand = calcStandings(playedMs);       // 已赛真实积分
      const predictStand = calcStandings(ms);           // 含未赛预测（预测最终出线）
      const qStatus = qualifyStatus(c);
      const lockedIn = Object.keys(qStatus).filter(k=>qStatus[k]==='in');
      const lockedOut = Object.keys(qStatus).filter(k=>qStatus[k]==='out');
      const predTop2 = predictStand.slice(0,2).map(t=>t.c).filter(x=>qStatus[x]!=='in');
      const tagOf = code => qStatus[code]==='in'?'<span class="q-tag q-in">已出线</span>':qStatus[code]==='out'?'<span class="q-tag q-out">已出局</span>':'';
      const metaParts = [];
      if(lockedIn.length) metaParts.push(`<span class="qm qm-in">✅ 已出线 ${lockedIn.map(x=>TEAMS[x].n).join('/')}</span>`);
      if(lockedOut.length) metaParts.push(`<span class="qm qm-out">❌ 已出局 ${lockedOut.map(x=>TEAMS[x].n).join('/')}</span>`);
      if(predTop2.length) metaParts.push(`<span class="qm qm-pred">🔮 预测 ${predTop2.map(x=>TEAMS[x].n).join('/')}</span>`);
      if(!metaParts.length) metaParts.push('<span class="qm">开赛待定</span>');
      return `<div class="group-block reveal ${c!=='A'?'hide':''}" data-block="${c}">
        <div class="group-block__head">
          <div class="group-block__title"><em>${c}</em>组</div>
          <div class="group-block__meta">${metaParts.join(' ')}</div>
        </div>
        <div class="group-block__body">
          ${realStand.length?`<table class="standings"><tbody>${
            realStand.map((t,i)=>`<tr class="${i<2?'qual':''} ${qStatus[t.c]||''}">
              <td class="s-rank">${i+1}</td>
              <td class="s-flag">${flagImg(t.c,40)}</td>
              <td class="s-name">${TEAMS[t.c].n}${tagOf(t.c)}</td>
              <td class="s-rec">${t.w}${t.d}${t.l}</td>
              <td class="s-gd">${t.gd>0?'+':''}${t.gd}</td>
              <td class="s-pts">${t.pts}</td>
            </tr>`).join('')
          }</tbody></table>`:''}
          <div class="matches">${ms.map(mm=>matchCard(mm, GROUPS.indexOf(mm))).join('')}</div>
        </div>
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
  /* FIFA 32强第三名slot允许的来源组 */
  const SLOT_SOURCES = {
    3:['A','B','C','D','F'], 6:['C','D','F','G','H'], 7:['C','E','F','H','I'],
    8:['E','H','I','J','K'], 9:['B','E','F','I','J'], 10:['A','E','H','I','J'],
    13:['E','F','G','I','J'], 16:['D','E','I','J','L']
  };
  /* 回溯分配 8 个最佳第三到对应 slot（满足来源组约束 + 唯一占用） */
  function assignThirds(thirds){
    const slots=[3,6,7,8,9,10,13,16];
    const used=new Set(); const assign={};
    function bt(i){
      if(i>=slots.length) return true;
      const allow=SLOT_SOURCES[slots[i]];
      for(const t of thirds){
        if(used.has(t.g)||!allow.includes(t.g)) continue;
        used.add(t.g); assign[slots[i]]=t.code;
        if(bt(i+1)) return true;
        used.delete(t.g);
      }
      return false;
    }
    return bt(0)?assign:null;
  }
  /* 淘汰赛单场预测：实时 Elo 决定胜者，泊松模型生成比分 */
  function predictKO(h,a){
    if(!h||!a||!TEAMS[h]||!TEAMS[a]) return null;
    const th=TEAMS[h], ta=TEAMS[a];
    const strongIsH = th.r>=ta.r;
    const [lh,la]=lambdas(th.r,ta.r,false);
    // 确定性种子（两队代码）→ 同输入同输出，不同对决比分多样（不再全 1-0）
    let seed=0; for(const c of (h+a)) seed=(seed*31+c.charCodeAt(0))>>>0;
    const rng=()=>{seed=(seed*1103515245+12345)>>>0;return (seed>>>8)/16777215;};
    const poissonSample=lambda=>{const L=Math.exp(-lambda);let k=0,p=1;do{k++;p*=rng();}while(p>L);return k-1;};
    // 弱队进球按泊松采样；强队净胜 1~3 球（种子决定，比分自然多样）
    const weakG = Math.min(poissonSample(strongIsH?la:lh),3);
    const margin = 1 + (rng()<0.45?1:0) + (rng()<0.12?1:0);
    const strongG = weakG + margin;
    const hs = strongIsH?strongG:weakG;
    const as = strongIsH?weakG:strongG;
    const w = strongIsH?h:a;
    const loser = strongIsH?a:h;
    const dElo = Math.abs(Math.round(ELO(th.r)-ELO(ta.r)));
    const close = Math.abs(th.r-ta.r)<3;
    return {h,a,hs,as,w,et:(close&&margin===1)?1:0,
      note:`${TEAMS[w].n}晋级 · Elo +${dElo}${close&&margin===1?'（势均力敌，加时险胜）':''}`};
  }
  let knockoutReal=[];   // 淘汰赛真实赛果（已踢场次覆盖推演）
  /* 完整动态重推演：出线 → 第三名分配 → 32强对阵 → 逐轮胜者（已踢用真实） */
  function buildKnockout(){
    // 真实赛果查找：基于 koSchedule 已赛场（state=post），覆盖所有轮次
    const realMatch=(h,a)=>{
      if(!h||!a) return null;
      const pool = koSchedule && koSchedule.length ? koSchedule : knockoutReal;
      const r=pool.find(x=>x.state==='post' && ((x.h===h&&x.a===a)||(x.h===a&&x.a===h)));
      if(!r) return null;
      let w=r.hs>r.as?r.h:(r.as>r.hs?r.a:null);
      if(!w && r.winner) w=r.winner==='h'?r.h:r.a;   // 常规平局 → ESPN 点球胜者
      return w?{h,a,hs:r.hs,as:r.as,w,et:(r.hs===r.as)?1:0,note:`真实赛果 · ${TEAMS[w].n}晋级`,real:true}:null;
    };
    const koPick=(h,a)=>realMatch(h,a)||predictKO(h,a);
    // 32 强对阵：优先 ESPN 真实赛程（schedule.json），无则回退 GROUPS 推演
    const r32raw = koSchedule && koSchedule.filter(x=>x.round==='32强');
    let r32;
    if(r32raw && r32raw.length>=2){
      r32 = r32raw.map(x=>koPick(x.h,x.a)).filter(Boolean);
    } else {
      const codes='ABCDEFGHIJKL'.split('');
      const W={}; const thirds=[];
      for(const g of codes){
        const ms=GROUPS.filter(m=>m[0]===g);
        const st=calcStandings(ms);
        if(st.length<3) return null;
        W[g]=st.slice(0,3).map(x=>x.c);
        const t=st[2];
        thirds.push({g,code:t.c,pts:t.pts,gd:t.gd,gf:t.gf});
      }
      thirds.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
      const assign=assignThirds(thirds.slice(0,8));
      if(!assign) return null;
      const pick = s => assign[s];
      const r32def=[
        [W.A[1],W.B[1]],[W.C[0],W.F[1]],[W.E[0],pick(3)],[W.F[0],W.C[1]],
        [W.E[1],W.I[1]],[W.I[0],pick(6)],[W.A[0],pick(7)],[W.L[0],pick(8)],
        [W.D[0],pick(9)],[W.G[0],pick(10)],[W.H[0],W.J[1]],[W.K[1],W.L[1]],
        [W.B[0],pick(13)],[W.D[1],W.G[1]],[W.J[0],W.H[1]],[W.K[0],pick(16)]
      ];
      r32=r32def.map(([h,a])=>koPick(h,a)).filter(Boolean);
    }
    if(!r32 || r32.length<2) return null;
    // 通用配对：按 pairings 索引配对（默认相邻 [0,1][2,3]…），覆盖真实赛果
    const mk=(arr,pairings)=>{
      const ps = pairings || arr.map((_,i)=> i%2===0?[i,i+1]:null).filter(Boolean);
      const r=[];
      ps.forEach(([i,j])=>{
        const m1=arr[i], m2=arr[j];
        if(!m1||!m2) return;
        const real=realMatch(m1.w,m2.w);
        if(real){r.push(real);return;}
        const m=predictKO(m1.w,m2.w);
        if(!m1.real) m.tbdH=[m1.h,m1.a];
        if(!m2.real) m.tbdA=[m2.h,m2.a];
        r.push(m);
      });
      return r;
    };
    // 16 强：优先 ESPN 真实赛程（schedule round='16强'），否则回退 R32 相邻配对
    const r16raw = koSchedule && koSchedule.filter(x=>x.round==='16强');
    let r16;
    if(r16raw && r16raw.length>=8){
      r16 = r16raw.map(x=>koPick(x.h,x.a)).filter(Boolean);
    } else {
      r16 = mk(r32);
    }
    // 8 强：FIFA bracket 交叉配对 QF1=[0,1] QF2=[4,5] QF3=[2,3] QF4=[6,7]
    const qf = mk(r16, [[0,1],[4,5],[2,3],[6,7]]);
    const sf = mk(qf);   // 半决赛：相邻
    if(sf.length<2) return null;
    const final=koPick(sf[0].w,sf[1].w);
    const l0=sf[0].h===sf[0].w?sf[0].a:sf[0].h;
    const l1=sf[1].h===sf[1].w?sf[1].a:sf[1].h;
    const third=koPick(l0,l1);
    return {r32,r16,qf,sf,final:[final],third:[third]};
  }
  const tbdPct=(c1,c2)=>Math.round(TEAMS[c1].r/(TEAMS[c1].r+TEAMS[c2].r)*100);
  function koCard(m, roundLabel, isFinal=false){
    const {d,v,h,a,hs,as,w,et,note,tbdH,tbdA,real} = m;
    const focus = isFocus(h,a);
    const champ = onChampPath(h,a);
    const cls = ['ko-card', isFinal?'is-final':'', focus?'is-focus':'', champ?'is-champ':'', real?'is-real':''].filter(Boolean).join(' ');
    const winH = !tbdH && w===h, winA = !tbdA && w===a;
    const teamBlock=(code,tbd,win)=>tbd
      ? `<span class="ko-team__flag">${flagImg(tbd[0],40)}</span><span class="ko-team__name ko-tbd">${TEAMS[tbd[0]].n}/${TEAMS[tbd[1]].n}<small>晋级 ${tbdPct(tbd[0],tbd[1])}%·${100-tbdPct(tbd[0],tbd[1])}%</small></span><span class="ko-team__score ko-team__score--tbd">?</span>`
      : `<span class="ko-team__flag">${flagImg(code,40)}</span><span class="ko-team__name">${TEAMS[code].n}</span><span class="ko-team__score ${win&&et?'et':''}">${tbd?0:(code===h?hs:as)}</span>`;
    return `<div class="${cls}" data-h="${h}" data-a="${a}" role="button" tabindex="0" style="cursor:pointer">
      ${focus?`<span class="focus-tag">焦点战</span>`:''}
      ${real?`<span class="focus-tag" style="background:rgba(74,222,128,.18);color:var(--win)">真实赛果</span>`:''}
      <div class="ko-card__round">${roundLabel}${d?`<span class="ko-card__date">${d}</span>`:''}</div>
      <div class="ko-team ${winH?'win':(tbdH?'tbd':'lose')}">${teamBlock(h,tbdH,winH)}</div>
      <div class="ko-team ${winA?'win':(tbdA?'tbd':'lose')}">${teamBlock(a,tbdA,winA)}</div>
      <div class="ko-card__note">${tbdH||tbdA?'⏳ 对阵待定(上轮未踢) · 推演':note}</div>
    </div>`;
  }

  function renderBracket(){
    const ko = dynamicKO || KNOCKOUT;
    const col = (label,arr,final=false)=>`<div class="bracket__col">
      <div class="bracket__col-title">${label}</div>
      ${arr.map(m=>koCard(m,'',final)).join('')}
    </div>`;
    const r32 = ko.r32;
    const half = Math.ceil(r32.length/2);
    const r32html = `<div class="bracket__col bracket__col--r32">
      <div class="bracket__col-title">32 强 · <em>${dynamicKO?'实时出线':'Round of 32'}</em></div>
      <div class="r32-grid">
        <div>${r32.slice(0,half).map(m=>koCard(m,'')).join('')}</div>
        <div>${r32.slice(half).map(m=>koCard(m,'')).join('')}</div>
      </div>
    </div>`;
    $('#bracketTree').innerHTML = r32html +
      col('16 强 · <em>R16</em>', ko.r16) +
      col('8 强 · <em>QF</em>', ko.qf) +
      col('4 强 · <em>SF</em>', ko.sf) +
      `<div class="bracket__col">
        <div class="bracket__col-title">决赛 · <em>Final</em></div>
        ${koCard(ko.final[0],'',true)}
        <div style="margin-top:18px"><div class="bracket__col-title" style="opacity:.6">季军战</div>${koCard(ko.third[0],'')}</div>
       </div>`;
    $$('.ko-card').forEach(c=>c.addEventListener('click',()=>openKOMatch(c.dataset.h,c.dataset.a)));
  }

  /* ============ 淘汰赛对决详情（点 ko-card 弹出，含历史交锋） ============ */
  function openKOMatch(h,a){
    if(!h||!a||!TEAMS[h]||!TEAMS[a]) return;
    $('#matchViewTitle').textContent = `${TEAMS[h].n} vs ${TEAMS[a].n}`;
    $('#matchBody').innerHTML = koMatchHTML(h,a);
    $('#matchView').hidden=false;
    document.body.style.overflow='hidden';
    window.scrollTo(0,0);
  }
  function koMatchHTML(h,a){
    const th=TEAMS[h], ta=TEAMS[a];
    const ko = dynamicKO || KNOCKOUT;
    const labels={r32:'32强',r16:'16强',qf:'8强',sf:'半决赛',final:'决赛',third:'季军战'};
    let match=null, label='';
    for(const r of Object.keys(labels)){
      const found=(ko[r]||[]).find(m=>(m.h===h&&m.a===a)||(m.h===a&&m.a===h));
      if(found){match=found;label=labels[r];break;}
    }
    const [lh,la]=lambdas(th.r,ta.r,false);
    const eh=ELO(th.r), ea=ELO(ta.r);
    const h2h=H2H[`${h}-${a}`]||H2H[`${a}-${h}`];
    const pw=Math.round(1/(1+Math.pow(10,(ta.r-th.r)/30))*100);
    const pl=Math.round(1/(1+Math.pow(10,(th.r-ta.r)/30))*100);
    const pd=Math.max(8,100-pw-pl);
    const weakK=th.r<ta.r?h:a;
    const upsetRisk=Math.min((weakK===h?pw:pl)+pd,99);
    const upsetTag=upsetRisk>=40?`<span class="ko-upset ko-upset--hi">🔥 高爆冷风险 ${upsetRisk}%</span>`:upsetRisk>=25?`<span class="ko-upset ko-upset--mid">⚠️ 冷门可能 ${upsetRisk}%</span>`:`<span class="ko-upset ko-upset--lo">✓ 预测无爆冷 (${upsetRisk}%)</span>`;
    const N=6,mat=[];
    for(let i=0;i<N;i++){mat[i]=[];for(let j=0;j<N;j++)mat[i][j]=poissonPmf(i,lh)*poissonPmf(j,la)*100;}
    const flat=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++)flat.push({s:i+'-'+j,p:mat[i][j]});
    flat.sort((x,y)=>y.p-x.p);const top5=flat.slice(0,5);
    return `
      <div class="mv-head">
        <div class="mv-meta">${label||'淘汰赛'}${match?` · ${match.d||''}${match.v?' · '+match.v:''}`:''} · 模型推演 ${upsetTag}</div>
        <div class="mv-scoreboard">
          <div class="mv-team"><div class="mv-flag">${flagImg(h,160)}</div><div class="mv-name">${th.n}</div><div class="mv-elo">Elo ${eh} · 实力 ${th.r.toFixed(1)}</div></div>
          <div class="mv-score pred">${match?`${match.hs}<span>:</span>${match.as}`:'<small>待定</small>'}</div>
          <div class="mv-team"><div class="mv-flag">${flagImg(a,160)}</div><div class="mv-name">${ta.n}</div><div class="mv-elo">Elo ${ea} · 实力 ${ta.r.toFixed(1)}</div></div>
        </div>
      </div>
      <div class="mv-grid">
        <div class="mv-card">
          <h3>三态概率 <small>融合模型</small></h3>
          <div class="tri-bar"><div class="tri tri-w" style="width:${pw}%">${th.n} ${pw}%</div><div class="tri tri-d" style="width:${pd}%">平 ${pd}%</div><div class="tri tri-l" style="width:${pl}%">${ta.n} ${pl}%</div></div>
          <div class="mv-xg">期望进球 <b>${lh.toFixed(2)}</b> : <b>${la.toFixed(2)}</b></div>
        </div>
        <div class="mv-card">
          <h3>最可能比分 <small>泊松模型</small></h3>
          <div class="mv-top5">${top5.map(t=>`<span class="topscore"><b>${t.s}</b><i>${t.p.toFixed(1)}%</i></span>`).join('')}</div>
        </div>
      </div>
      ${match&&match.note?`<div class="mv-card mv-read"><h3>🤖 模型解读</h3><div style="font-size:14px;line-height:1.8;color:var(--text-dim)">${match.note}${match.et?'（势均力敌，预测经加时决出）':''}</div></div>`:''}
      ${h2h?`<div class="mv-card"><h3>历史交锋 <small>${th.n} vs ${ta.n}</small></h3>
        <div class="tv-h2h">
          <div class="tv-h2h-head"><b>${h2h.total}</b></div>
          <div class="tv-h2h-wc"><i>世界杯</i>${h2h.wc}</div>
          <div class="tv-h2h-last"><i>最近</i>${h2h.last}</div>
          <div class="tv-h2h-tag">${h2h.tag}</div>
        </div>
      </div>`:''}
      <div class="mv-note">※ 淘汰赛为模型推演（实力差 + 泊松模拟）；历史交锋来自 Wikipedia/Transfermarkt。随小组出线确定，对阵与预测自动更新。</div>
    `;
  }

  /* ============ 5. 冠军之路时间线 ============ */
  function renderPath(){
    const path = buildChampionPath(getChampion());
    const data = path.length ? path : CHAMPION_PATH;
    $('#pathTimeline').innerHTML = data.map((p,i)=>`
      <div class="path-step reveal">
        <div class="path-step__dot">${i+1}</div>
        <div class="path-step__body">
          <div class="path-step__flag">${flagImg(p.code,80)}</div>
          <div class="path-step__opp">${p.round} vs ${p.opp}<small>${p.real?'真实赛果':'模型推演'}</small></div>
          <div class="path-step__score">${p.score}</div>
        </div>
      </div>`).join('');
  }

  /* ============ 半决赛深度分析 ============ */
  function renderSemifinal(){
    const sfData=[
      {date:'7月14日 04:00',venue:'阿灵顿·AT&T 体育场',h:'FRA',a:'ESP',
       h2h:{total:'38次交锋 西班牙18胜7平13负（占优）',wc:'1982 小组赛 1-1 平',last:'2021 欧国联决赛 法国 2-1 胜',tag:'欧洲德比，技术流正面对撞'}},
      {date:'7月15日 03:00',venue:'亚特兰大·梅赛德斯奔驰体育场',h:'ENG',a:'ARG',
       h2h:{total:'14次交锋 英格兰5胜5平4负（几乎均势）',wc:'1986 八强 马拉多纳"上帝之手"2-1 · 1998 小组 英格兰点球胜 · 2002 小组 阿根廷1-0',last:'2018 小组赛未相遇',tag:'宿敌恩怨：马岛+1986上帝之手，每次都是战争'}}
    ];
    const refNote='FIFA 通常赛前 48 小时公布。参考：QF1 法国 vs 摩洛哥由清一色阿根廷裁判组（主裁 Facundo Tello 特略）执法，引发"人情局"争议（摩洛哥在阿根廷裁判执法的世界杯比赛从未输球）。半决赛裁判安排将更受瞩目。';
    $('#sfBody').innerHTML = sfData.map(sf=>{
      const th=TEAMS[sf.h],ta=TEAMS[sf.a];
      const p=predictMatch(sf.h,sf.a)||{pw:50,pd:25,pl:25};
      const formRow=c=>{
        const grp=GROUPS.filter(m=>m[7]===1&&(m[3]===c||m[4]===c));
        const ko=koSchedule.filter(x=>x.state==='post'&&(x.h===c||x.a===c));
        return [...grp,...ko].map(m=>{
          const mh=m[3]??m.h, ma=m[4]??m.a;
          const isH=mh===c;
          const hs=m[5]??m.hs??0, as=m[6]??m.a??0;
          const opp=isH?ma:mh;
          const r=hs>as?'w':hs<as?'l':'d';
          return `<i class="sf-fr sf-fr--${r}" title="${TEAMS[c].n}${hs}-${as}${TEAMS[opp]?TEAMS[opp].n:opp}">${r.toUpperCase()}</i>`;
        }).join('');
      };
      const stars=c=>(STARS[c]||[]).slice(0,3).map(s=>`<span class="sf-star">${s.n}<small>${s.p||s.club||''}</small></span>`).join('');
      return `<div class="sf-card reveal">
        <div class="sf-top"><span class="sf-meta">${sf.date} · ${sf.venue}</span><span class="sf-prob">${th.n} <b>${p.pw}%</b> · 平 ${p.pd}% · ${ta.n} <b>${p.pl}%</b></span></div>
        <div class="sf-match">
          <div class="sf-side"><span class="fc-flag">${flagImg(sf.h,64)}</span><b>${th.n}</b><small>Elo ${ELO(th.r)}</small></div>
          <div class="sf-vs">VS</div>
          <div class="sf-side"><span class="fc-flag">${flagImg(sf.a,64)}</span><b>${ta.n}</b><small>Elo ${ELO(ta.r)}</small></div>
        </div>
        <div class="sf-grid">
          <div class="sf-sec"><h4>📜 历史交锋</h4><p class="sf-h2h">${sf.h2h.total}</p>${sf.h2h.wc?`<small>世界杯：${sf.h2h.wc}</small>`:''}${sf.h2h.last?`<small>最近：${sf.h2h.last}</small>`:''}<div class="sf-tag">${sf.h2h.tag}</div></div>
          <div class="sf-sec"><h4>📊 本届状态</h4><div class="sf-formt"><b>${th.n}</b><div class="sf-formrow">${formRow(sf.h)}</div></div><div class="sf-formt"><b>${ta.n}</b><div class="sf-formrow">${formRow(sf.a)}</div></div></div>
          <div class="sf-sec"><h4>⭐ 核心球员</h4><div class="sf-stars">${stars(sf.h)}</div><div class="sf-stars">${stars(sf.a)}</div></div>
          <div class="sf-sec"><h4>⚖️ 裁判因素</h4><p class="sf-ref">半决赛裁判待 FIFA 公布</p><small>${refNote}</small></div>
        </div>
      </div>`;
    }).join('');
    $$('#sfBody .reveal').forEach(el=>el.classList.add('in'));
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

  /* ============ 球队详情就地展开（夺冠概率榜 accordion） ============ */
  function teamDetailHTML(code){
    const t = TEAMS[code];
    if(!t) return '';
    const p = PROFILES.find(x=>x.c===code);
    const elo = ELO(t.r);
    const delta = t.r - (t.r0||t.r);
    const grpCodes = Object.keys(TEAMS).filter(c=>TEAMS[c].g===t.g);
    const grp = grpCodes.map(c=>({c,r:TEAMS[c].r})).sort((a,b)=>b.r-a.r);
    const grpRank = grp.findIndex(x=>x.c===code)+1;
    const tier = t.r>=85?'顶级豪门':t.r>=78?'争冠热门':t.r>=68?'中上游':t.r>=58?'中游':'弱旅';
    const formPct = Math.max(8, Math.min(100, 50 + delta*8));
    const formTxt = delta>0.5?`势头上升 ↑${delta.toFixed(1)}`:delta<-0.5?`回落 ↓${Math.abs(delta).toFixed(1)}`:'走势平稳';
    const isHost = META.host.includes(t.n);
    const grpPct = (5-grpRank)/4*100;
    const grpRole = grpRank===1?'出线大热':grpRank===2?'直接竞争者':'出线边缘';
    /* 小组积分榜（该组已赛实时） */
    const stand = grpCodes.map(c=>{
      const row={c,pts:0,gf:0,ga:0,gp:0,w:0,d:0,l:0};
      GROUPS.forEach(m=>{
        if(m[0]!==t.g||m[7]!==1) return;
        const isH=m[3]===c, isA=m[4]===c;
        if(!isH&&!isA) return;
        const gf=isH?m[5]:m[6], ga=isH?m[6]:m[5];
        row.gp++; row.gf+=gf; row.ga+=ga;
        if(gf>ga){row.pts+=3;row.w++} else if(gf===ga){row.pts+=1;row.d++} else row.l++;
      });
      row.gd=row.gf-row.ga; return row;
    }).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
    /* 该队攻防数据 */
    const myM = GROUPS.filter(m=>(m[3]===code||m[4]===code)&&m[7]===1);
    let gf=0,ga=0,win=0,draw=0,loss=0;
    myM.forEach(m=>{
      const isH=m[3]===code; const f=isH?m[5]:m[6], a=isH?m[6]:m[5];
      gf+=f; ga+=a; if(f>a)win++; else if(f<a)loss++; else draw++;
    });
    const gd=gf-ga;
    /* 小组赛赛程（3 场，已赛比分 / 未赛预测） */
    const fixHTML = GROUPS.filter(m=>m[3]===code||m[4]===code).map(m=>{
      const isH=m[3]===code, opp=isH?m[4]:m[3], played=m[7]===1;
      const f=isH?m[5]:m[6], a=isH?m[6]:m[5];
      const tag=played?(f>a?'胜':f<a?'负':'平'):'未赛';
      const tagCls=played?(f>a?'w':f<a?'l':'d'):'p';
      const wPct=isH?m[8]:m[10], lPct=isH?m[10]:m[8];
      const sc=played?`${f} : ${a}`:`胜${wPct}·平${m[9]}·负${lPct}`;
      return `<div class="tv-fix"><span class="tv-fix__tag ${tagCls}">${tag}</span><span class="tv-fix__vs">${isH?'主':'客'} ${flagImg(opp,40,'tv-flag-sm')}${TEAMS[opp].n}</span><span class="tv-fix__sc ${played?'':'pred'}">${sc}</span></div>`;
    }).join('');
    const myH2H = Object.keys(H2H).filter(k=>k.split('-').includes(code)).map(k=>{
      const opp=k.split('-').find(c=>c!==code); return {opp, ...H2H[k]};
    });
    return `
      <div class="tv-head">
        <div class="tv-flag">${flagImg(code,160)}</div>
        <div style="flex:1;min-width:0">
          <div class="tv-title">${t.n}</div>
          <div class="tv-sub">${t.g}组 · ${tier} · Elo ${Math.round(elo)}${FIFA_RANK[code]?` · FIFA 第${FIFA_RANK[code]}`:''} · ${p?p.title:'世界杯参赛队'}</div>
          <div class="tv-stats">
            <div class="tv-stat"><b>${t.r.toFixed(1)}</b><small>实力分</small></div>
            <div class="tv-stat"><b>${t.oDyn.toFixed(1)}%</b><small>夺冠概率</small></div>
            <div class="tv-stat"><b>${delta>=0?'+':''}${delta.toFixed(1)}</b><small>已赛调整</small></div>
            <div class="tv-stat"><b>${win}-${draw}-${loss}</b><small>战绩</small></div>
          </div>
        </div>
      </div>
      <div class="mv-grid">
        <div class="mv-card">
          <h3>${t.g}组积分榜 <small>已赛实时</small></h3>
          <table class="tv-table">
            <thead><tr><th style="text-align:left">球队</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>进</th><th>失</th><th>净</th><th>分</th></tr></thead>
            <tbody>${stand.map(s=>`<tr class="${s.c===code?'tv-me':''}"><td><span class="tv-flag-sm">${flagImg(s.c,40,'')}</span>${TEAMS[s.c].n}</td><td>${s.gp}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.gf}</td><td>${s.ga}</td><td style="color:${s.gd>=0?'var(--win)':'var(--loss)'}">${s.gd>0?'+':''}${s.gd}</td><td class="tv-pts">${s.pts}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="mv-card">
          <h3>攻防数据 <small>已赛 ${myM.length} 场</small></h3>
          <div class="tv-wdl">
            <span class="w"><b>${win}</b><small>胜</small></span>
            <span class="d"><b>${draw}</b><small>平</small></span>
            <span class="l"><b>${loss}</b><small>负</small></span>
          </div>
          <div class="tv-statrow"><span>进球 / 失球</span><b>${gf} / ${ga}</b></div>
          <div class="tv-statrow"><span>净胜球</span><b style="color:${gd>=0?'var(--win)':'var(--loss)'}">${gd>0?'+':''}${gd}</b></div>
          <div class="tv-statrow"><span>场均进 / 失</span><b>${myM.length?(gf/myM.length).toFixed(2):'—'} / ${myM.length?(ga/myM.length).toFixed(2):'—'}</b></div>
        </div>
      </div>
      <div class="mv-card">
        <h3>排名分数组成 <small>四因子驱动</small></h3>
        <div class="tv-factor">
          <div class="tv-factor__label">基础实力 ELO<small>权重 45% · Opta+赔率</small></div>
          <div class="tv-factor__bar"><div class="tv-factor__fill" style="width:${t.r}%"></div></div>
          <div class="tv-factor__val"><b>${t.r.toFixed(1)}</b>${tier}</div>
        </div>
        <div class="tv-factor">
          <div class="tv-factor__label">当前赛事状态<small>权重 25% · 已赛 Elo</small></div>
          <div class="tv-factor__bar"><div class="tv-factor__fill ${delta<0?'bad':''}" style="width:${formPct}%"></div></div>
          <div class="tv-factor__val"><b>${formTxt}</b>净 ${delta>=0?'+':''}${delta.toFixed(1)}</div>
        </div>
        <div class="tv-factor">
          <div class="tv-factor__label">战术克制<small>权重 15% · 组内卡位</small></div>
          <div class="tv-factor__bar"><div class="tv-factor__fill dim" style="width:${grpPct}%"></div></div>
          <div class="tv-factor__val"><b>${t.g}组第${grpRank}</b>${grpRole}</div>
        </div>
        <div class="tv-factor">
          <div class="tv-factor__label">伤病 / 主场<small>权重 15% · 外部变量</small></div>
          <div class="tv-factor__bar"><div class="tv-factor__fill ${isHost?'':'dim'}" style="width:${isHost?100:55}%"></div></div>
          <div class="tv-factor__val"><b>${isHost?'东道主加成':'中立场'}</b>${isHost?'主场之利':'无主场分'}</div>
        </div>
      </div>
      <div class="mv-grid">
        <div class="mv-card">
          <h3>核心球员 <small>${STARS[code]?'2025-26 阵容':'参考 ESPN/FIFA'}</small></h3>
          ${STARS[code]?`<div class="tv-stars">${STARS[code].map(s=>{const pn={GK:'门',DF:'卫',MF:'中',FW:'锋'}[s.p];return `<div class="tv-star"><span class="tv-star__pos p${s.p}">${pn}</span><div class="tv-star__info"><b>${s.n}</b><small>${s.c}</small></div></div>`;}).join('')}</div>`:`<div class="tv-squad">${p?p.core:'该队 26 人名单详见 ESPN/FIFA 官方。'}</div>`}
          ${p?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--text-mute);line-height:1.7">${p.history}</div>`:''}
        </div>
        <div class="mv-card">
          <h3>小组赛赛程 <small>3 场</small></h3>
          ${fixHTML}
        </div>
      </div>
      ${p?`<div class="mv-card"><h3>模型研判 <small>优势 vs 风险</small></h3>
        <div class="tv-analysis">
          <div class="tv-analysis__item up"><h4>▲ 核心优势</h4>${p.edge}</div>
          <div class="tv-analysis__item dn"><h4>▼ 潜在风险</h4>${p.risk}</div>
        </div></div>`:''}
      ${myH2H.length?`<div class="mv-card"><h3>历史宿敌交锋 <small>经典对决</small></h3>
        ${myH2H.map(h=>`<div class="tv-h2h"><div class="tv-h2h-head"><span class="tv-flag-sm">${flagImg(h.opp,40,'')}</span><b>vs ${TEAMS[h.opp].n}</b><span class="tv-h2h-total">${h.total}</span></div><div class="tv-h2h-wc"><i>世界杯</i>${h.wc}</div><div class="tv-h2h-last"><i>最近</i>${h.last}</div><div class="tv-h2h-tag">${h.tag}</div></div>`).join('')}
      </div>`:''}
      <div class="mv-note">※ 实力分与夺冠概率基于四因子模型（ELO 45% + 当前状态 25% + 战术 15% + 伤病主场 15%）+ 25,000 次蒙特卡洛；积分榜 / 攻防 / 赛程为本届真实数据，已赛 Elo 动态调整。<b>再点该行可收起</b></div>
    `;
  }
  function toggleTeam(code,row){
    const detail=row&&row.nextElementSibling;
    const open=detail&&!detail.hidden;
    $$('.power-detail').forEach(d=>d.hidden=true);
    $$('.power-row').forEach(r=>r.classList.remove('is-open'));
    if(!open&&detail){
      detail.innerHTML=teamDetailHTML(code);
      detail.hidden=false;
      row.classList.add('is-open');
      setTimeout(()=>detail.scrollIntoView({behavior:'smooth',block:'nearest'}),60);
    }
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
      let latest = '';
      data.forEach(r => {
        if(r.played !== 1) return;
        map[r.h + '_' + r.a] = r;
        if(r.d && r.d > latest) latest = r.d;
        // 反向视角：ESPN 的主客顺序未必与本站 GROUPS 一致（例：加拿大 vs 瑞士，
        // 本站按举办地记加拿大为主场，ESPN 可能记瑞士为 home）。建立反向 key 并
        // 交换比分，确保无论哪队在前都能正确合并，避免"已赛却仍显示预测"。
        map[r.a + '_' + r.h] = { h:r.a, a:r.h, hs:r.as, as:r.hs, played:1 };
      });
      let n = 0;
      GROUPS.forEach(m => {
        const r = map[m[3] + '_' + m[4]];
        if(r){ m[5] = r.hs; m[6] = r.as; m[7] = 1; n++; }
      });
      if(latest){ META.updated = latest; META.modelUpdate = latest; }
      if(n) console.log(`✓ 实时赛果已合并 ${n} 场，截至 ${latest || META.updated}`);
    }catch(e){ console.warn('results.json 未加载，使用内置数据'); }
  }
  /* 每 5 分钟重新拉取赛果合并，重算实力与概率榜；焦点因「相对最新完赛」的偏移定位，
     会随新赛果自然前移 —— 实现"随赛程同步当前最新赛果"。用户手动翻页后偏移固定，
     不强拉回，保持浏览位置。 */
  async function syncLatestFocus(){
    await Promise.all([loadResults(), loadKnockoutReal(), loadSchedule()]);
    applyElo(); recomputeOdds();
    renderPower();
    renderAccuracy();
    renderHero();
    console.log('✓ 赛果焦点已同步最新赛程');
  }
  /* 滚动隐藏按钮由 renderAccuracy 内的 scroll 监听处理（原生滚动已足够丝滑） */
  /* 加载 ESPN 球员统计（覆盖内置 PLAYER_AWARDS，实现球员榜自动更新） */
  async function loadPlayerStats(){
    try{
      const res = await fetch('assets/data/player-stats.json?t='+Date.now());
      if(!res.ok) return;
      const d = await res.json();
      if(d.scorers && d.scorers.length){
        PLAYER_AWARDS.scorers = d.scorers.map(p=>({n:p.name,c:p.c,t:TEAMS[p.c]?TEAMS[p.c].n:(p.t||''),g:p.g,club:''}));
        PLAYER_AWARDS.assists = (d.assists||[]).map(p=>({n:p.name,c:p.c,t:TEAMS[p.c]?TEAMS[p.c].n:(p.t||''),a:p.a,club:''}));
        PLAYER_AWARDS.updated = d.updated;
        console.log(`✓ 球员榜已加载 ESPN 实时数据 (截至 ${d.updated})`);
      }
    }catch(e){ console.warn('player-stats.json 未加载，使用内置数据'); }
  }
  async function loadKnockoutReal(){
    try{
      const res=await fetch('assets/data/knockout-real.json?t='+Date.now());
      if(!res.ok) return;
      knockoutReal=await res.json();
      console.log(`✓ 淘汰赛真实赛果 ${knockoutReal.length} 场已加载`);
    }catch(e){ console.warn('knockout-real.json 未加载，使用纯推演'); }
  }
  /* 加载淘汰赛完整赛程（含未赛预告）→ koSchedule，供赛果焦点淘汰赛模块 */
  async function loadSchedule(){
    try{
      const res=await fetch('assets/data/schedule.json?t='+Date.now());
      if(!res.ok) return;
      koSchedule=await res.json();
      // "数据截至"覆盖为淘汰赛最新已赛日期（小组赛 results 止 6-27，淘汰赛已推进到 6-28+）
      const ko=koSchedule.filter(x=>x.state==='post'&&x.d);
      if(ko.length){
        const latest=ko.map(x=>x.d).sort().pop();
        if(latest && (!META.updated || latest>META.updated)) META.updated=latest;
      }
      console.log(`✓ 淘汰赛赛程 ${koSchedule.length} 场已加载（赛果焦点·淘汰赛模块）`);
    }catch(e){ console.warn('schedule.json 未加载，淘汰赛模块仅显示已赛'); }
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
  function renderFormRows(code){
    const resMap = {'胜':'win','平':'draw','负':'loss'};
    const ms = GROUPS.filter(m => (m[3]===code||m[4]===code) && m[7]===1);
    if(!ms.length) return '<div class="form-empty">暂无已赛</div>';
    return ms.map(m=>{
      const isHome = m[3]===code;
      const opp = isHome ? m[4] : m[3];
      const gf = isHome ? m[5] : m[6];
      const ga = isHome ? m[6] : m[5];
      const res = gf>ga ? '胜' : gf<ga ? '负' : '平';
      return `<div class="form-row"><span class="form-tag form-tag--${resMap[res]}">${res}</span><span class="form-opp">${isHome?'':'客 '}${TEAMS[opp].n}</span><b class="form-sc">${gf}-${ga}</b></div>`;
    }).join('');
  }
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
      <div class="mv-card">
        <h3>本届世界杯战绩 <small>真实已赛</small></h3>
        <div class="mv-form">
          <div class="mv-form-col">
            <div class="mv-form-head">${flagImg(h,80)}<span>${th.n}</span></div>
            ${renderFormRows(h)}
          </div>
          <div class="mv-form-col">
            <div class="mv-form-head">${flagImg(a,80)}<span>${ta.n}</span></div>
            ${renderFormRows(a)}
          </div>
        </div>
      </div>
      <div class="mv-note">※ 热力图与期望进球由泊松模型实时计算；战绩为本届世界杯已赛真实结果；近期状态含 Elo 动态调整。跨赛事近10场与历史交锋需额外数据源，暂以本届真实战绩呈现。</div>
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
    await loadPlayerStats();
    await loadKnockoutReal();
    await loadSchedule();
    applyElo();
    recomputeOdds();
    dynamicKO = buildKnockout();
    renderHero();
    renderPower();
    renderPlayerAwards();
    renderUpsets();
    $$('.up-sort__btn').forEach(btn=>btn.addEventListener('click',()=>{
      upsetSort=btn.dataset.sort;
      $$('.up-sort__btn').forEach(b=>b.classList.toggle('active',b.dataset.sort===upsetSort));
      renderUpsets();
    }));
    renderGroups();
    renderBracket();
    renderPath();
    renderSemifinal();
    renderProfiles();
    renderMethod();
    // 默认焦点模块：小组赛全完赛且淘汰赛赛程已就绪 → 跟随到淘汰赛（最新赛果在淘汰赛）
    { const grpDone = GROUPS.every(m=>m[7]===1); focusTab = (grpDone && koSchedule.length) ? 'ko' : 'group'; }
    renderAccuracy();
    $('#accuracyBody').addEventListener('click',e=>{
      const tb=e.target.closest('.focus-tab');
      if(tb&&tb.dataset.tab){ focusTab=tb.dataset.tab; focusScrollIdx=-1; renderAccuracy(); return; }
      const b=e.target.closest('.focus-nav');
      if(b&&b.dataset.dir){
        const sc=$('#focusScroll'); if(sc) sc.scrollBy({left:(+b.dataset.dir)*sc.offsetWidth, behavior:'smooth'});
      }
    });
    setInterval(syncLatestFocus, 5*60*1000); // 每 5 分钟同步最新赛果，焦点随赛程自动前进
    observeReveal();
    setupTheme();
    window.addEventListener('hashchange', router);
    router();
    // 平滑滚动锚点偏移
    $$('a[href^="#"]').forEach(a=>{
      if(a.id==='matchBack') return; // 返回按钮走独立逻辑，避免被平滑滚动 preventDefault 拦截
      a.addEventListener('click',e=>{
        const id=a.getAttribute('href');
        if(id.length>1){ const el=$(id); if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth'}); } }
      });
    });
    // 返回赛程：关闭详情弹层 + 清 hash + 回顶部（修复原 href="#groups" 被滚动拦截致点击无反应）
    const back=$('#matchBack');
    if(back) back.addEventListener('click',e=>{
      e.preventDefault();
      closeMatch();
      history.replaceState(null,'',location.pathname+location.search);
      window.scrollTo({top:0,behavior:'smooth'});
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
