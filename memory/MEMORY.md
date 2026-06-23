项目规范和当前架构详见 CONTRIBUTING.md（文件结构树+技术约束+RBAC权限+部署）。
RBAC/用户权限现状详见 docs/superpowers/handoff-2026-06-21-rbac.md；历史实现计划仅作参考，不要重复执行。
场景大全/成效看板导出图片共用 src/lib/export-image-style.ts；html2canvas clone 阶段统一修 padding/gap、glass fallback、Ant Table 横向展开与 ping 阴影。
字段管理页 /admin/bitable-field-map 以 AI Land 字段资产为主视图；聚合逻辑在 src/lib/bitable/field-assets.ts，飞书字段稳定身份依赖 bitable_field_map.field_id，旧 key/type/API 底层编辑区不再作为页面入口。
工具页「生成飞书卡片」走 /api/resources/card-to-me，只发送给当前登录用户的 feishu_open_id；权限点是 resource.generate-feishu-card，062 迁移默认授予 user 角色。
生产库禁止执行 supabase/migrations/full_migration.sql；它会 DROP users/courses/apps/cases 等业务表。生产只复制执行明确编号的增量迁移，恢复/PITR 流程见 docs/operator-runbook.md。
公开课从飞书多维表同步到 courses；生产恢复需先执行 068/069/070，保留 courses.id 为 UUID，用 courses.feishu_record_id 普通唯一索引做 upsert。22P02/42P10 排查见 docs/operator-runbook.md。
资源投稿若出现 Supabase schema cache 缺 `apps` 列，先查生产库是否漏执行资源模块迁移；072_apps_resource_schema_prod_hotfix.sql 已在 2026-06-23 生产验证通过，覆盖 content/is_featured/resource_type/applicable_departments。
场景大全/AI 大赛/成效看板默认读 competition_submissions 快照；飞书刷新只走手动/cron 同步。同步必须保留已有 competition_reviews 的历史 submission id，重复排查见 docs/operator-runbook.md。
