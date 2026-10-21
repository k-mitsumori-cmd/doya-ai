-- c3c: preserve each generated variant's electric estimate at materialization.
-- Existing plans remain unknown (NULL); no current-engine backfill is legitimate.
ALTER TABLE tenjikai_booth_plan
  ADD COLUMN "electricYen" integer,
  ADD COLUMN "electricDetail" text;

ALTER TABLE tenjikai_booth_plan
  ADD CONSTRAINT tenjikai_booth_plan_electric_pair_ck CHECK (
    ("electricYen" IS NULL AND "electricDetail" IS NULL) OR
    ("electricYen" IS NOT NULL AND "electricYen" >= 0 AND
     "electricDetail" IS NOT NULL AND char_length("electricDetail") BETWEEN 1 AND 240)
  );
