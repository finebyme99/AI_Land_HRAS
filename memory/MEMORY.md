项目规范和当前架构详见 CONTRIBUTING.md（文件结构树+技术约束+RBAC权限+部署）。
RBAC/用户权限现状详见 docs/superpowers/handoff-2026-06-21-rbac.md；历史实现计划仅作参考，不要重复执行。
场景大全/成效看板导出图片共用 src/lib/export-image-style.ts；html2canvas clone 阶段统一修 padding/gap、glass fallback、Ant Table 横向展开与 ping 阴影。
字段管理页 /admin/bitable-field-map 以 AI Land 字段资产为主视图；聚合逻辑在 src/lib/bitable/field-assets.ts，飞书字段稳定身份依赖 bitable_field_map.field_id，旧 key/type/API 底层编辑区不再作为页面入口。
