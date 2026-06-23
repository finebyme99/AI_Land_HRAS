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
- 个人中心积分事件表：`user_point_events`，由 `064_user_point_events.sql` 创建；历史案例和工具积分分别由 `065`、`066` 回填。
