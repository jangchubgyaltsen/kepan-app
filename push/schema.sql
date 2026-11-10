CREATE TABLE IF NOT EXISTS subs (
  endpoint  TEXT PRIMARY KEY,
  sub       TEXT NOT NULL,
  time      TEXT NOT NULL,          -- 提醒时间 HH:MM（用户所在时区）
  tz        TEXT NOT NULL,          -- 时区，如 Asia/Shanghai
  last_sent TEXT NOT NULL DEFAULT '', -- 最后一次提醒的本地日期
  created   INTEGER NOT NULL
);
