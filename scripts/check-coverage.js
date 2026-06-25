/**
 * 校验 results.json 的每场赛果能否在 data.js 的 GROUPS 里找到对应比赛。
 * 双向匹配（主客顺序无关），找出真正"匹配不上"的遗漏。
 * 本地手动：node scripts/check-coverage.js
 */
const fs = require('fs');
const path = require('path');

const dataJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'data.js'), 'utf8');
const results = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'data', 'results.json'), 'utf8'));

// 提取 GROUPS 每场的 (组, home, away)
// 元组结构：['组','城市',主场标记,'主码','客码',主分,客分,已赛,...]
const re = /\[\s*'([A-Z])'\s*,\s*'[^']*'\s*,\s*[01]\s*,\s*'([A-Z]+)'\s*,\s*'([A-Z]+)'\s*,/g;
const groupMatches = [];
let m;
while ((m = re.exec(dataJs))) groupMatches.push({ g: m[1], h: m[2], a: m[3] });

console.log(`GROUPS 定义比赛: ${groupMatches.length} 场`);
console.log(`results.json 完赛: ${results.length} 场\n`);

let matched = 0, reversed = 0;
const orphan = [];
for (const r of results) {
  const fwd = groupMatches.find(gm => gm.h === r.h && gm.a === r.a);
  const rev = groupMatches.find(gm => gm.h === r.a && gm.a === r.h);
  if (fwd) { matched++; }
  else if (rev) { matched++; reversed++; }
  else orphan.push(r);
}

console.log(`✓ 能匹配 GROUPS: ${matched} 场`);
console.log(`   其中主客顺序与 GROUPS 相反（靠反向 key 合并）: ${reversed} 场 —— 修复前会被漏掉`);
console.log(`✗ 匹配不上（真正遗漏/数据异常）: ${orphan.length} 场`);
orphan.forEach(r => console.log(`   ${r.h} ${r.hs}-${r.as} ${r.a}`));

console.log(`\n结论：${orphan.length === 0 ? '✅ results.json 无遗漏，全部能正确合并' : '⚠ 存在匹配不上的场次，需排查 code 映射'}`);
