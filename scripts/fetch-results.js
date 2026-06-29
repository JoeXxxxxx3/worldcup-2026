/**
 * 抓取 ESPN 世界杯实时赛果，更新 assets/data/results.json
 * 由 GitHub Actions 定时调用；也可本地手动：node scripts/fetch-results.js
 * 数据源：ESPN 公开 scoreboard API（免认证）
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'data', 'results.json');
// 小组赛日期范围（2026-06-11 ~ 06-27）
const DAYS = [];
for (let d = 11; d <= 27; d++) DAYS.push('202606' + String(d).padStart(2, '0'));
const URL = d => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${d}`;

// ESPN 缩写 → 本站代码（绝大多数一致，少数在此覆盖）
const CODE = { SCOT: 'SCO' };
const code = a => CODE[a] || a;

async function main() {
  const results = [];
  const seen = new Set();
  for (const d of DAYS) {
    let data;
    try {
      const r = await fetch(URL(d));
      data = await r.json();
    } catch (e) { console.warn(`⚠ 抓取 ${d} 失败: ${e.message}`); continue; }
    for (const ev of data.events || []) {
      const c = ev.competitions && ev.competitions[0];
      if (!c) continue;
      const comps = c.competitors || [];
      const home = comps.find(x => x.homeAway === 'home');
      const away = comps.find(x => x.homeAway === 'away');
      if (!home || !away) continue;
      // 只记录已完赛场次（state === 'post'）
      const post = ev.status && ev.status.type && ev.status.type.state === 'post';
      if (!post) continue;
      const h = code(home.team.abbreviation);
      const a = code(away.team.abbreviation);
      const key = h + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ h, a, hs: +home.score, as: +away.score, played: 1, d: d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8) });
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
  console.log(`✓ 已更新 ${results.length} 场完赛赛果 → ${path.relative(process.cwd(), OUT)}`);
  await fetchPlayerStats();
  await fetchKnockoutReal();
}

/* 抓淘汰赛真实赛果（32强~决赛，6-28~7-19）→ knockout-real.json */
async function fetchKnockoutReal(){
  const KOUT = path.join(__dirname, '..', 'assets', 'data', 'knockout-real.json');
  const KO_DAYS = [];
  for(let d=28;d<=30;d++) KO_DAYS.push('202606'+String(d).padStart(2,'0'));
  for(let d=1;d<=19;d++) KO_DAYS.push('202607'+String(d).padStart(2,'0'));
  const res=[]; const seen=new Set();
  for(const d of KO_DAYS){
    let data;
    try{ const r=await fetch(URL(d)); data=await r.json(); }catch(e){ continue; }
    for(const ev of data.events||[]){
      const c=ev.competitions&&ev.competitions[0]; if(!c) continue;
      const comps=c.competitors||[];
      const home=comps.find(x=>x.homeAway==='home'), away=comps.find(x=>x.homeAway==='away');
      if(!home||!away) continue;
      if(ev.status&&ev.status.type&&ev.status.type.state!=='post') continue;
      const h=code(home.team.abbreviation), a=code(away.team.abbreviation);
      const key=[h,a].sort().join('_');
      if(seen.has(key)) continue; seen.add(key);
      res.push({h,a,hs:+home.score,as:+away.score,d:d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)});
    }
  }
  fs.writeFileSync(KOUT, JSON.stringify(res,null,2)+'\n');
  console.log(`✓ 淘汰赛真实赛果 ${res.length} 场 → ${path.relative(process.cwd(), KOUT)}`);
}

/* 抓 ESPN 球员统计（射手榜 / 助攻榜）→ player-stats.json */
async function fetchPlayerStats(){
  const POUT = path.join(__dirname, '..', 'assets', 'data', 'player-stats.json');
  const SURL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics';
  try {
    const r = await fetch(SURL);
    const d = await r.json();
    const goals = (d.stats||[]).find(s=>s.name==='goalsLeaders');
    const ast = (d.stats||[]).find(s=>s.name==='assistsLeaders');
    const extract = (leaders, k) => (leaders||[]).slice(0,12).map(l=>{
      const a = l.athlete||{};
      const t = a.team||{};
      // ESPN 英文名 → 中文常用译名（未命中则保留英文）
      const en = a.displayName||'';
      return { name: PLAYER_ZH[en]||en, en: en, c: code(t.abbreviation||''), t: t.displayName||'', [k]: l.value };
    });
    const out = {
      updated: new Date().toISOString().slice(0,10),
      scorers: extract(goals&&goals.leaders, 'g'),
      assists: extract(ast&&ast.leaders, 'a')
    };
    fs.writeFileSync(POUT, JSON.stringify(out, null, 2) + '\n');
    console.log(`✓ 球员榜已更新: 射手${out.scorers.length} 助攻${out.assists.length} → ${path.relative(process.cwd(), POUT)}`);
  } catch(e){ console.warn(`⚠ 球员统计抓取失败: ${e.message}`); }
}

// ESPN 球员英文名 → 中文译名（常见球星；未列出的保留英文）
const PLAYER_ZH = {
  'Lionel Messi':'梅西','Kylian Mbappé':'姆巴佩','Erling Haaland':'哈兰德','Vinícius Júnior':'维尼修斯',
  'Rodri':'罗德里','Jude Bellingham':'贝林厄姆','Harry Kane':'凯恩','Cristiano Ronaldo':'C罗',
  'Lamine Yamal':'亚马尔','Bruno Fernandes':'布鲁诺·费尔南德斯','Kevin De Bruyne':'德布劳内',
  'Mohamed Salah':'萨拉赫','Virgil van Dijk':'范迪克','Frenkie de Jong':'德容','Cody Gakpo':'加克波',
  'Jamal Musiala':'穆西亚拉','Florian Wirtz':'维尔茨','Kai Havertz':'哈弗茨','Joshua Kimmich':'基米希',
  'Bukayo Saka':'萨卡','Phil Foden':'福登','Declan Rice':'赖斯','Ousmane Dembélé':'登贝莱',
  'Michael Olise':'奥利塞','Alexander Isak':'伊萨克','Bruno Guimarães':'吉马良斯','Antoine Griezmann':'格列兹曼',
  'Lautaro Martínez':'劳塔罗','Álvaro Morata':'莫拉塔','Deniz Undav':'温达夫','Jonathan David':'乔纳森·大卫',
  'Alphonso Davies':'阿方索·戴维斯','Takefusa Kubo':'久保建英','Kaoru Mitoma':'三笘薰','Wataru Endo':'远藤航',
  'Luka Modrić':'莫德里奇','Federico Valverde':'巴尔韦德','Darwin Núñez':'努涅斯','James Rodríguez':'J罗',
  'Luis Díaz':'路易斯·迪亚斯','Achraf Hakimi':'阿什拉夫','Hakim Ziyech':'齐耶赫','Pedri':'佩德里',
  'Dani Olmo':'奥尔莫','Nico Williams':'尼科·威廉姆斯','Marcus Rashford':'拉什福德','Cole Palmer':'帕尔默',
  'Rafael Leão':'莱奥','Ruben Dias':'鲁本·迪亚斯','Bernardo Silva':'B席','Ismael Saibari':'赛巴里'
};

main().catch(e => { console.error(e); process.exit(1); });
