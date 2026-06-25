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
}

main().catch(e => { console.error(e); process.exit(1); });
