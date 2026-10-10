CREATE TABLE IF NOT EXISTS counts (
  day TEXT NOT NULL,
  metric TEXT NOT NULL,
  label TEXT NOT NULL,
  total INTEGER NOT NULL CHECK(total >= 0),
  PRIMARY KEY(day, metric, label)
) WITHOUT ROWID;
