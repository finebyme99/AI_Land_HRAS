# AI Land 运维手册

## 数据库迁移红线

生产库只允许执行明确编号的增量迁移，例如 `063_user_level_names.sql`、`064_user_point_events.sql`、`065_backfill_published_case_points.sql`、`066_backfill_published_resource_points.sql`。

不要在生产库执行 `supabase/migrations/full_migration.sql`。它是重建全库 schema 的脚本，开头包含 `DROP TABLE IF EXISTS ... CASCADE`，会删除 `users`、`courses`、`apps`、`cases`、互动记录等业务表。它只适合空库初始化或一次性重建环境。

执行生产 SQL 前必须完成：

1. 确认 SQL 文件没有 `DROP TABLE`、`TRUNCATE`、无条件 `DELETE FROM`。
2. 在 Supabase Dashboard 确认可用备份或 PITR 恢复点。
3. 优先在临时恢复库或 staging 库试跑。
4. 只复制本次需要的增量迁移文件内容，不复制 `full_migration.sql`。

## 事故恢复

SQL Editor 中已经执行完成的 DDL/DML 不能像文本编辑器一样撤销。除非执行时手动包在未提交的事务里，否则 `DROP TABLE` 只能通过备份或外部数据源恢复。

如果误执行了破坏性 SQL：

1. 立刻停止继续运行 SQL、同步任务和写入操作。
2. 在 Supabase Dashboard 进入 `Database` -> `Backups`，选择事故前的时间点恢复。
3. 如可选，优先 `Restore to a new project`，确认 `users`、`courses`、`apps`、`cases` 等表数据完整后再切换生产配置。
4. 如果没有 PITR 或备份，只能从飞书同步、seed、日志或手工来源重建数据。

## 课程与资源恢复线索

- 课程同步入口：`POST /api/courses/sync`，会从飞书课程源重建 `courses`。同步前确认生产库至少执行过 `068_courses_sync_schema_hotfix.sql`、`069_courses_feishu_record_id.sql`、`070_courses_feishu_record_id_upsert_index.sql`。
- 课程同步写入策略：`courses.id` 保持数据库 UUID；飞书多维表记录 ID 写入 `courses.feishu_record_id`，并通过 `courses_feishu_record_id_key` 普通唯一索引做幂等 upsert。不要把飞书 `record_id` 写入 `courses.id`。
- 课程同步冒烟：用有 `course.sync` 权限的登录态请求 `POST https://hras-ai-land.vercel.app/api/courses/sync`，期望响应类似 `{"total":13,"synced":13,"inserted":13,"skipped":0}`；随后查 `courses` 表数量或请求 `GET /api/courses` 验证页面数据源。
- 如果同步返回 `22P02 invalid input syntax for type uuid`，说明仍在把飞书 record id 写入 UUID 主键，检查部署是否包含 `src/lib/course-sync.ts` 和 `/api/courses/sync` 的 `feishu_record_id` upsert 改动。
- 如果同步返回 `42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification`，执行或检查 `070_courses_feishu_record_id_upsert_index.sql`，确保 `courses_feishu_record_id_key` 不是部分唯一索引。
- 工具资源表：`apps`。用户投稿、审核状态、点赞收藏依赖数据库备份；没有备份时无法从代码自动恢复完整历史。
- 如果资源投稿返回 `Could not find the '<column>' column of 'apps' in the schema cache`，优先检查生产库是否漏执行资源模块增量迁移。执行 `072_apps_resource_schema_prod_hotfix.sql` 可一次性补齐 `apps.content`、`apps.is_featured`、`apps.resource_type`、`apps.applicable_departments`，并刷新 PostgREST schema cache。
- 资源 schema 热修复冒烟：用 service role 或 Supabase Table Editor 确认 `apps` 可读取 `content,is_featured,resource_type,applicable_departments`；随后在 `/resources/apps/create?category=%E7%BA%B5%E8%85%BE%E4%BA%BA%E4%B8%93%E5%B1%9E%20Skills` 提交一次测试资源，期望进入待审核或发布状态。
- 个人中心积分事件表：`user_point_events`，由 `064_user_point_events.sql` 创建；历史案例和工具积分分别由 `065`、`066` 回填。

## AI 场景快照同步

- 页面读取路径：`GET /api/wish-pool`、`GET /api/competitions/progress`、`GET /api/admin/competitions/overview` 默认从 Supabase `competition_submissions` 读取快照，不在页面打开时全量读飞书。
- 同步入口：管理后台字段映射页 `/admin/bitable-field-map` 的「全量同步飞书场景数据」按钮调用 `POST /api/admin/competition-sync`；定时任务 `GET /api/cron/sync-competitions` 复用同一套同步服务。
- 前台页面不再提供场景数据同步按钮。`/api/wish-pool/sync`、`/api/wish-pool/sync-field-map` 已删除；`/api/competitions/sync` 仅保留 GET 只读兼容，不负责飞书写入型同步。
- 同步逻辑入口：`src/lib/competition-snapshot-sync.ts` 使用 `src/lib/competition-snapshot.ts` 的 canonical ID 规则。若旧 `competition_submissions.id` 已被 `competition_reviews.submission_id` 使用，且旧行 `record_url` 指向当前飞书记录，必须保留旧 ID，把最新字段写回旧 ID，再删除新 ID 影子行。
- 同步状态入口：`src/lib/competition-sync-store.ts` 通过 `074_competition_sync_status.sql` 的 `platform_settings` 字段记录最近尝试时间、最近成功同步时间、状态、成功/变化/跳过/清重等结果。前台最近更新时间文案为「数据最近更新时间：...」。
- 场景大全落地计划字段依赖生产库执行 `073_competition_landing_plan_fields.sql`，包括 `progress_record`、`planned_start_date`、`pilot_date`、`rollout_date`、`full_launch_date`、`biz_owner`、`ai_owner`。如果页面里进展备注、计划日期、业务/AI 对接人为空，或同步返回 schema cache 缺列，先确认该迁移已执行并刷新 PostgREST schema cache。
- 重复排查：按 `period + record_url` 中的 `record` 参数分组检查 `competition_submissions`；若同一飞书记录出现两行，先确认 `competition_reviews` 是否挂在旧 ID 上，不要直接删除带评审记录的行。
- 冒烟：后台同步后确认页面同步状态显示成功及变化数量；检查目标方案在 `/competitions`、`/wish-pool`、成效看板中只出现一条；SQL/脚本层确认 `competition_submissions` 按 `period + record_url.record` 分组没有重复。
