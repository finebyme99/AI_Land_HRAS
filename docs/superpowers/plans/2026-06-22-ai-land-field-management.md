# AI Land Field Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/admin/bitable-field-map` from a Feishu-field list into an AI Land-field-centered management view.

**Architecture:** Keep `bitable_field_map` as the source-binding table and add a pure aggregation layer that groups rows by AI Land key. The admin API returns AI Land field assets plus a Feishu unused-field inbox; the page renders business-facing columns while preserving current edit/sync controls.

**Tech Stack:** Next.js 16 App Router, React 19, Ant Design 6, Supabase, Node `node:test`.

---

### Task 1: Field Asset Aggregation

**Files:**
- Create: `src/lib/bitable/field-assets.ts`
- Test: `test/bitable-field-assets.test.mjs`

- [ ] **Step 1: Write failing tests**

Test that rows with the same AI Land key are grouped into one asset, aliases keep page context, renamed Feishu fields are tagged, and `unknown_` keys become Feishu unused fields.

- [ ] **Step 2: Run tests and verify red**

Run: `node --test test/bitable-field-assets.test.mjs`
Expected: fail because `src/lib/bitable/field-assets.ts` does not exist.

- [ ] **Step 3: Implement aggregation helper**

Create a pure helper that accepts field-map rows and returns:
- `assets`: AI Land fields keyed by canonical key
- `unusedFeishuFields`: Feishu fields not bound to AI Land
- `stats`: counts for used, pending, inactive, renamed, unused

- [ ] **Step 4: Run tests and verify green**

Run: `node --test test/bitable-field-assets.test.mjs`
Expected: pass.

### Task 2: Admin API Response Shape

**Files:**
- Modify: `src/app/api/admin/bitable-field-map/route.ts`

- [ ] **Step 1: Extend GET response**

Return the existing `records` for backward compatibility plus new `assets` and `unusedFeishuFields`.

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: pass.

### Task 3: Admin UI List

**Files:**
- Modify: `src/app/admin/bitable-field-map/page.tsx`

- [ ] **Step 1: Replace table columns with AI Land field columns**

Columns:
- AI Land 字段
- 使用位置
- 数据来源
- 来源详情
- 改名状态
- 字段状态
- 依赖字段
- 操作

- [ ] **Step 2: Preserve edit/sync actions**

Keep sync, refresh, preview, enable/disable, API roles, edit key/type for bound Feishu fields.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: pass.

### Task 4: Metadata Migration

**Files:**
- Create: `supabase/migrations/062_bitable_field_map_asset_metadata.sql`

- [ ] **Step 1: Add status/notes columns**

Add lightweight metadata columns to support management workflow without blocking current mapping:
- `asset_status text`
- `asset_note text`

- [ ] **Step 2: Verify SQL is additive**

Migration must be `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` only.

### Task 5: Final Verification

- [ ] **Step 1: Run focused tests**

Run: `node --test test/bitable-field-assets.test.mjs test/bitable-field-map-identity.test.mjs`
Expected: pass.

- [ ] **Step 2: Run all mjs tests**

Run: `node --test test/*.mjs`
Expected: pass.

- [ ] **Step 3: Run typecheck and build**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: both pass.

- [ ] **Step 4: Run lint and report existing blockers**

Run: `npm run lint`
Expected: current repo may still fail on unrelated `src/app/login/page.tsx:78`; report exact output.
