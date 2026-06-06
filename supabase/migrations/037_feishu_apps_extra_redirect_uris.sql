-- feishu_apps 加 extra_redirect_uris：多 origin（本地 + 生产）共用一个 app
ALTER TABLE feishu_apps ADD COLUMN IF NOT EXISTS extra_redirect_uris text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN feishu_apps.extra_redirect_uris IS '除主 redirect_uri 外的额外回调地址（多 origin 用，如本地 + 生产）';
