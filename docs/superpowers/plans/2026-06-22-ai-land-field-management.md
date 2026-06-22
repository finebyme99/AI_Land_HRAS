# AI Land 字段管理交接

## 当前状态

`/admin/bitable-field-map` 已从“飞书字段底层映射编辑页”收敛为业务侧的 **AI Land 字段管理** 页。

页面以 AI Land 字段为基准展示：

- `AI Land 字段`：标准 key、用户可见字段名、不同页面/视图中的别名
- `使用位置`：成效看板、场景池、场景池卡片等消费位置
- `数据源 / 处理逻辑`：飞书多维表字段、AI Land 计算字段、AI Land 系统字段
- `字段状态`：已使用、已绑定未展示、飞书已改名、已停用等
- `依赖字段 / 说明`：计算字段的上游字段或来源说明
- `飞书新增未使用字段`：飞书多维表已拉取，但 AI Land 暂未消费的字段池

旧版 `key/type/API/启停/删除` 底层编辑表、操作列和字段预览弹窗已从页面移除。相关后端 CRUD 路由仍保留，避免破坏已有 API 兼容性。

## 关键实现

- `src/lib/bitable/field-assets.ts`
  - 纯函数聚合层，把 `bitable_field_map` 行聚合成 AI Land 字段资产。
  - 将 `unknown_` key 归入 `unusedFeishuFields`。
  - 根据 `field_id` 和 `previous_field_name` 标识飞书字段改名。
- `src/app/api/admin/bitable-field-map/route.ts`
  - GET 继续返回旧 `records`，同时返回 `assets`、`unusedFeishuFields`、`assetStats`。
- `src/app/admin/bitable-field-map/page.tsx`
  - 只渲染业务口径字段资产表和飞书未使用字段池。
  - 保留 `刷新` 和 `从飞书拉取新字段`。
- `supabase/migrations/061_bitable_field_map_field_id_identity.sql`
  - 让字段映射以 `field_id` 作为稳定身份，支持飞书字段更名。

## 验证记录

已验证：

- `node --test test/bitable-field-assets.test.mjs test/bitable-field-map-identity.test.mjs`
- `node --test test/*.mjs`
- `npx tsc --noEmit`
- `npm run build`
- `npx eslint src/app/admin/bitable-field-map/page.tsx`
- 浏览器打开 `localhost:3000/admin/bitable-field-map`，确认页面无横向溢出，旧底层映射区和操作列已消失。

已知全局 lint 遗留：`npm run lint` 仍受既有 `src/app/login/page.tsx:78` 的 `react-hooks/immutability` 阻塞；字段管理页面单独 lint 通过。
