# 评审一览页面二轮改版 — 设计文档

> 日期：2026-06-11
> 目标：复审定稿 + 全员公示
> 改版范围：前端 page、overview API、sync 路由、库结构（如需）
> 关联 commit：1082c6a（上一轮改版）

---

## 一、改造清单（来自用户拍板）

1. **卡片头部**：标题上移到第一排，与 `#编号` / `状态 Tag` 同行；团队+提报人放第二排
2. **量化数据区**（一区）：保留 3 个核心数据（月省工时 / 提效比例 / Token 费），下面追加 4 字段 2×2 网格（原/现人均工时 + 原/现人数）
3. **三区顺序**：量化数据 → 复用价值（突出） → 评审得分
4. **复用价值**（二区）：渐变 Hero 条 + 横排三个元素（等级 tag + 完整描述 + x 系数），数据源原文展示
5. **团队字段**：保留 `提报人团队`（飞书多维表格当前字段名）
6. **评审管理 Tab 合并**：搁置
7. **多期对比**：不管
8. **后端同步改**：overview API、sync 路由、库结构（如需）

---

## 二、视觉决策（brainstorm 拍板）

| 决策点 | 选定方案 |
|---|---|
| 复用价值"突出"程度 | 渐变 Hero 条（按等级变色） |
| 复用价值内部排版 | 横排三个元素：`[等级 Tag]` `完整描述` `x 系数` |
| 量化 4 字段排版 | 2×2 网格，每格 3 行（label / before→after / 单位说明） |
| 头部标题排版 | 14px truncate-1，与 `#编号` / `状态 Tag` 同行 |

---

## 三、卡片新结构

```
┌─ 卡片 ──────────────────────────────────────┐
│ [排名徽章]                                    │
│   #001 [已评]  AI 简历初筛自动化评估流… ← 14px 截断 │
│   GEU · 张三 / 李四                            │
├──────────────────────────────────────────────┤
│ 一、量化数据                                    │
│  ┌────┬────┬────┐                            │
│  │月省 │提效│Token│  12.5h   50%   ¥20/月     │
│  └────┴────┴────┘                            │
│  ─────────────────────────────────           │
│  原人均工时  5h  →  1h     原月均人数  3→1    │  ← 2×2
│  现人均工时  ─    →  1h     现月均人数  ─→1    │  ← 2×2
├══════════════════════════════════════════════┤  ← 渐变背景
│ 二、未来复用推广价值                            │     按等级
│  [🥇 金]  跨多个BU/多个条线可用   ×3          │  ← 横排 3 元素
├──────────────────────────────────────────────┤
│ 三、评审得分                                    │
│   78.5  /  100       N 人评                   │
└──────────────────────────────────────────────┘
```

---

## 四、组件级变更（page.tsx）

### 4.1 头部（line 360-377）

原结构：
```tsx
<div className="flex items-center justify-between mb-1.5 pl-12">
  <span>#编号</span><Tag>状态</Tag>
</div>
<h3 className="mb-1 line-clamp-2">{标题}</h3>
<p>{团队} {提报人}</p>
```

新结构：
```tsx
<div className="flex items-center gap-2 mb-1.5 pl-12 min-w-0">
  <span className="font-mono text-xs shrink-0">#编号</span>
  <Tag className="shrink-0">状态</Tag>
  <h3 className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--foreground)' }}>
    {标题}
  </h3>
</div>
<p className="text-xs pl-12" style={{ color: 'var(--text-muted)' }}>
  {团队 && <Tag color="blue" className="mr-1">{团队}</Tag>}
  {提报人}
</p>
```

### 4.2 一、量化数据（line 379-390）

BeforeAfterMini 扩展为 4 字段 2×2 网格。重命名为 `QuantGrid2x2`：

```tsx
function QuantGrid2x2({ sub }: { sub: SubmissionDTO }) {
  const cells = [
    {
      label: '原人均工时',
      before: sub.beforeHoursPerPerson != null ? `${sub.beforeHoursPerPerson}h` : '—',
      after:  sub.afterHoursPerPerson  != null ? `${sub.afterHoursPerPerson}h`  : '—',
      unit: '小时/月',
    },
    {
      label: '原月均人数',
      before: sub.beforePeopleCount != null ? `${sub.beforePeopleCount}人` : '—',
      after:  sub.afterPeopleCount  != null ? `${sub.afterPeopleCount}人`  : '—',
      unit: '人',
    },
    {
      label: '现人均工时',
      before: sub.beforeHoursPerPerson != null ? `${sub.beforeHoursPerPerson}h` : '—',
      after:  sub.afterHoursPerPerson  != null ? `${sub.afterHoursPerPerson}h`  : '—',
      unit: '小时/月',
    },
    {
      label: '现月均人数',
      before: sub.beforePeopleCount != null ? `${sub.beforePeopleCount}人` : '—',
      after:  sub.afterPeopleCount  != null ? `${sub.afterPeopleCount}人`  : '—',
      unit: '人',
    },
  ];
  // 2x2 grid 渲染：grid-cols-2，gap-2
  // 每格：label(小灰) + before→after (大字 mono) + unit(小灰)
}
```

> 注：BeforeAfterMini（line 671-707）可保留作为"操作次数/单次时长"等扩展数据展示，本轮不删。

### 4.3 二、复用价值 Hero 条（新组件，line 407-419 改造）

`ReuseLevelTag` 保持（line 825-840），但不再单独显示。新增 `ReuseHeroStrip`：

```tsx
function ReuseHeroStrip({ level, fullText, coefficient }: {
  level: string | null;
  fullText: string | null;
  coefficient: string | null;  // 形如 "x3"（从 fullText regex 提取，或另存）
}) {
  // 等级 → 渐变背景（金/银/铜/无 → 紫）
  const styleMap = {
    '金': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    '银': 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%)',
    '铜': 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
    '_default': 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.02) 100%)',
  };
  const bg = styleMap[level] ?? styleMap._default;
  return (
    <div className="px-5 py-3" style={{ background: bg, color: ['金','银','铜'].includes(level) ? '#5a3a00' : '#1a1a1a' }}>
      <div className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ opacity: 0.7 }}>
        二、未来复用推广价值
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {level && <ReuseLevelTag level={level} />}
        {fullText && <span className="text-sm font-medium">{fullText}</span>}
        {coefficient && <span className="text-base font-bold font-mono ml-auto">{coefficient}</span>}
      </div>
    </div>
  );
}
```

**系数提取规则**：
- 优先从 `reuse_value`（`fullText`）中 regex 提取 `/x\d+/i`
- 提取不到则显示 null（不显示）
- 整个 `fullText` 完整展示（去掉现有 `match(/x\d+/i)?.[0] ?? sub.reuseValue` 这种只显示系数的写法）

### 4.4 三、评审得分（line 392-404 改造）

保持现状，下移到三区即可。

### 4.5 卡片顺序调整（line 379-419 改 380-440）

```
量化数据（行 1）
复用价值 Hero 条（行 2，新增/重排）
评审得分（行 3，下移）
```

---

## 五、API / Sync / DB 变更

### 5.1 `competition_submissions` 表

`reuse_value` / `reuse_value_level` 字段已存在（migration 040/041）。**本轮无 DB 变更**——除非用户后续要求拆分"系数"为独立列。

> 备选方案：migration 042 加 `reuse_coefficient TEXT` 列，从 `reuse_value` regex 提取写入。但本期先在前端 regex 提取。

### 5.2 `src/app/api/admin/competitions/overview/route.ts`

保持现有 SELECT 列表（含 `reuse_value` / `reuse_value_level`）和返回结构。**本轮无 API 变更**——前端可以从现有 `reuseValue` 字段提取系数。

### 5.3 `src/app/api/competitions/sync/route.ts`

保持现有 `FIELD_NAME_MAP`。"提报人团队" key 已经是 `'提报人团队': 'team'`，**无变更**。

---

## 六、Modal 同步更新

### 6.1 评审明细 Modal（line 467-523）

保持现状。

### 6.2 方案详情 Modal（line 526-632）

- `ReuseLevelTag` 区域（line 564-570）改为 `ReuseHeroStrip` 同款渐变背景展示，完整描述 + 系数
- 量化数据区域（QuantCard, line 729-786）保持，但增加 4 字段展示

### 6.3 Top 节省工时卡（line 278-308）

保持现状。

---

## 七、代码改动文件清单

| 文件 | 变更类型 | 范围 |
|---|---|---|
| `src/app/admin/reviews-overview/page.tsx` | 改 | 头部布局 / 量化 4 字段 / 复用价值 Hero 条 / 三区顺序 |
| `src/app/api/admin/competitions/overview/route.ts` | 不改 | — |
| `src/app/api/competitions/sync/route.ts` | 不改 | — |
| `supabase/migrations/*.sql` | 不改 | — |
| `src/types/index.ts` | 不改 | — |
| `docs/plans/2026-06-11-reviews-overview-redesign.md` | 新增 | 本文档 |

---

## 八、验收清单

- [ ] 卡片头部第一排：`#001` `[已评]` `标题（truncate-1）` 同行
- [ ] 卡片头部第二排：`GEU` 团队 tag + 提报人
- [ ] 一、量化数据：3 个核心数据 + 4 字段 2×2 网格
- [ ] 二、复用价值：渐变背景（按等级变色） + 横排 3 元素
- [ ] 三、评审得分：下移到第三区
- [ ] 5 月期数据 13 个方案全部正常渲染
- [ ] 金/银/铜三等级分别显示对应渐变背景
- [ ] 完整描述"跨多个BU/多个条线可用 x3" 完整展示 + x 系数单独加粗
- [ ] 方案详情 Modal 同步展示新布局
- [ ] 评审明细 Modal 保持现有布局
- [ ] 团队字段缺失时（无 `team` 值）头部第二排只显示提报人，不报错
- [ ] 同步按钮可用，sync 后刷新数据

---

## 九、风险与回退

- **风险 1**：x 系数 regex 提取失败时回退到无系数（不报错）。前端处理。
- **风险 2**：6 月期飞书字段变更——本期保持 5 月期结构稳定，6 月期另行评估。
- **回退**：commit 可 revert；Vercel 自动部署允许即时回退到上一 commit。
