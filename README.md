# ⚽ 2026 世界杯预言 · The Prophet's Table

> 基于四因子实力模型 + 25,000 次蒙特卡洛模拟的 **2026 FIFA 世界杯**完整预测网站。
> 暗色编辑风体育数据媒体，含小组赛全量赛程、淘汰赛 bracket 树、夺冠概率榜与球队深度档案。

🔗 **在线演示**：部署到 GitHub Pages 后填入你的地址

---

## 🏆 预测结论

| 名次 | 球队 | 路径关键战 |
|---|---|---|
| 🥇 冠军 | 🇫🇷 **法国** | 决赛 2-1 (加时) 胜西班牙 |
| 🥈 亚军 | 🇪🇸 西班牙 | 半决赛 2-1 胜阿根廷 |
| 🥉 季军 | 🇧🇷 巴西 | 季军战 3-1 胜阿根廷 |

**夺冠概率前三**（Opta 超级计算机 25,000 次模拟）：西班牙 16.1% · 法国 13.0% · 英格兰 11.2%

---

## ✨ 特性

- **48 队 / 72 场小组赛全量**：已完赛显示真实比分，未赛显示模型预测；每场附胜/平/负三态概率与最可能比分
- **完整淘汰赛 bracket**：32 强 → 16 强 → 8 强 → 4 强 → 决赛，横向滚动树状图，焦点战高亮
- **冠军之路**：法国六战封王时间线
- **夺冠概率榜**：横向条形可视化，悬停交互
- **球队深度档案**：六支争冠热门的核心阵容、近届战绩、战术克制与风险
- **真实国旗**：flagcdn 渲染（非 emoji，跨平台一致）
- **模型战绩面板**：已完赛命中率 + 胜负识别率 + 预测偏差场次，透明可验证
- **动态 Elo 自适应**：爆冷后实力分自动重算，夺冠概率与涨跌箭头实时更新
- **深浅色双主题**：一键切换，记忆偏好，首屏防闪烁
- **数据自动更新**：GitHub Actions 每 6 小时抓取 ESPN 真实赛果
- **时效性原则**：仅采用近 4–8 年数据，剔除远古荣誉噪声

---

## 🚀 本地预览

需要 Node.js（v18+）：

```bash
node server.js
# ▶ 打开 http://localhost:8765
```

或直接用浏览器打开 `index.html`（需联网加载国旗与字体）。

---

## 📦 部署到 GitHub Pages（让别人查阅）

1. **新建仓库**：在 [github.com/new](https://github.com/new) 创建一个公开仓库（如 `worldcup-2026`）
2. **推送代码**：
   ```bash
   git init
   git add .
   git commit -m "feat: 2026世界杯预测网站"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/worldcup-2026.git
   git push -u origin main
   ```
3. **开启 Pages**：仓库 `Settings → Pages → Source` 选 `Deploy from a branch`，分支 `main` / `/root`，Save
4. **访问**：约 1 分钟后打开 `https://<你的用户名>.github.io/worldcup-2026/`

> 也可拖到 [Netlify Drop](https://app.netlify.com/drop) 或 Vercel 一键部署，无需配置。

---

## 🔄 数据自动更新（核心特性）

网站会随赛事进行自动同步真实赛果，**无需手动改代码**：

1. **GitHub Actions 定时抓取**：每 6 小时（UTC 0/6/12/18 点）运行 `scripts/fetch-results.js`，从 ESPN 公开 API 拉取最新比分，更新 `assets/data/results.json` 并自动提交推送。也可在仓库 **Actions** 页手动触发「更新比分」工作流。
2. **前端实时合并**：页面加载时 fetch `results.json`，覆盖内置比分（已赛场显示真实结果，命中率随之重算）。
3. **动态 Elo 自适应**：每场已赛后按「实际 vs 预期」更新两队实力分——爆冷（弱胜强）大幅调整，大比分放大。实力分变化 → 夺冠概率自动重算 → 概率榜排序与涨跌箭头（↑/↓）实时反映状态。**预测随比赛进行不断调整。**

> 数据源：ESPN 免认证公开 API（`site.api.espn.com/.../fifa.world`），无需 key，稳定可用。

---

## 🧠 模型方法论

**四因子加权**：

| 因子 | 权重 | 说明 |
|---|---|---|
| 基础实力 ELO | 45% | Opta 超级计算机夺冠概率 + 博彩赔率双源校准 |
| 当前赛事状态 | 25% | 已完赛小组赛的净胜球、xG、控球率与对手强度 |
| 战术克制关系 | 15% | 历史交锋与风格相克（控球 vs 防反、身体 vs 技术） |
| 伤病与主场 | 15% | 伤病潮、轮换动机、东道主海拔与赛程旅行负荷 |

**时效性原则**：仅采用近 **4–8 年**（约 1–2 个世界杯周期）的球员状态、联赛表现与交锋记录作为预测权重。更早的历史荣誉因人员更迭、战术迭代，视为噪声剔除。

---

## 🛠 技术栈

纯静态站点，零构建依赖：
- HTML + CSS（自定义设计系统）+ 原生 JavaScript
- [flagcdn](https://flagcdn.com) 国旗 · [Google Fonts](https://fonts.google.com)（Space Grotesk / Inter / JetBrains Mono）

```
fifa/
├── index.html              # 页面骨架
├── server.js               # 本地预览服务（可选）
├── assets/
│   ├── css/main.css        # 设计系统（含深浅主题）
│   ├── data/results.json   # 实时赛果（GitHub Actions 自动更新）
│   └── js/
│       ├── data.js         # 全量数据（48队/72场/淘汰赛）
│       └── app.js          # 渲染 + Elo 动态调整
├── scripts/fetch-results.js # ESPN 赛果抓取脚本
├── .github/workflows/       # GitHub Actions 定时更新
└── README.md
```

---

## 📚 数据来源

- [ESPN 赛程比分](https://www.espn.com/soccer/story/_/id/48939282/2026-fifa-world-cup-fixtures-results-match-schedule-group-stage-knockout-rounds-bracket)
- [Opta 超级计算机预测](https://theanalyst.com/articles/who-will-win-2026-fifa-world-cup-predictions-opta-supercomputer)
- [USA Today 32 强对阵](https://www.usatoday.com/story/sports/soccer/worldcup/2026/06/22/world-cup-standings-bracket-scores-schedule/90639182007/)
- [FIFA 官方](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026)

---

## ⚠️ 免责声明

本站为数据可视化与模型推演作品，**仅供交流学习**。预测不构成任何投注建议，概率不代表确定结论。体育比赛存在不可建模的随机性。
