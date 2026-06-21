-- coin_sub_boxes
CREATE TABLE IF NOT EXISTS coin_sub_boxes (
    id                  BIGSERIAL   PRIMARY KEY,
    coin_id             TEXT        NOT NULL,
    cycle_number        INTEGER     NOT NULL,
    parent_box_index    INTEGER     NOT NULL,
    parent_phase        TEXT,
    parent_result       TEXT,
    sub_box_index       INTEGER     NOT NULL,
    sub_box_label       TEXT        NOT NULL,
    start_x             INTEGER     NOT NULL,
    end_x               INTEGER     NOT NULL,
    upper               REAL        NOT NULL,
    lower               REAL        NOT NULL,
    duration            INTEGER     NOT NULL,
    range_pct           REAL        NOT NULL,
    is_completed        INTEGER     DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
