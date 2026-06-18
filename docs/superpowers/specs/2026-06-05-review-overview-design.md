# AI 大赛评审记录一览页设计

**日期**：2026-06-05
**状态**：部分决策已定（菜单位置、权限、视图样式），待澄清后落定

## 已定决策

- 视图样式：卡片式（card grid）
- 穿透：评审明细走模态弹窗，方案详情走独立详情页
- 期号：单期 + 顶部期号下拉切换
- 顶部汇总条：期号 · 参赛数 · 已评数 · 未评数 · 平均分
- 排序/筛选：默认按总分降序 + 团队筛选条
- **菜单位置**：放在"评审管理"子菜单下（不进"管理后台"子菜单）
- **页面权限**：仅 `isAdmin`（不含 reviewer）

## 路由

| 路径 | 用途 |
|------|------|
| `/admin/reviews-overview` | 评审一览主页 |
| `GET /api/admin/competitions/overview?period=2605` | 数据接口 |

## 布局

```
顶部条：HRAS AI 大赛 · 评审一览  [期号下拉]
       10 参赛 · 7 已评 · 3 未评 · 平均 39.8
筛选条：团队[全部][HSSC][GUS]...    排序[总分▼]
卡片网格：#001 打卡智能体 ... 总分 42.3 ... [查看评审明细] [方案详情→]
```

## 数据契约

```ts
{
  period: '2605',
  summary: { total, reviewed, pending, avgScore },
  submissions: [{
    id, title, team, authorName, submittedAt,
    status: 'reviewed' | 'pending',
    totalScore, reviewCount,
    roleScores: { user, business, tech },
    reviews: [{
      reviewerName, reviewerRole,
      scores: { dim1: 4, ... },
      weightedScore, reason
    }]
  }]
}
```

## 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/app/admin/reviews-overview/page.tsx` |
| 新建 | `src/app/api/admin/competitions/overview/route.ts` |
| 改 | `src/components/Navigation.tsx`（在"评审管理"子菜单下加项；子菜单可见性保持 `isReviewer`） |
| 改 | `src/app/admin/reviews-overview/page.tsx` 入口检查 `isAdmin`（不是 `isReviewer`） |
