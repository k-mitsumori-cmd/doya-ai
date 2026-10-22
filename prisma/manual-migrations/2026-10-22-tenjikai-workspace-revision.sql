-- Tenjikai c3b2: additive normalized workspace columns and graph constraints.
-- One-shot manual migration. Run only after the read-only preflight below.
-- Existing unknown values stay NULL; no venue/plan/price/provenance backfill.
-- This source file does not authorize production DDL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  -- The old Prisma schema declares a nonunique plan lookup index and an
  -- optional documentId FK (ON DELETE SET NULL). Refuse an unfamiliar catalog
  -- rather than dropping a constraint whose semantics have drifted.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    WHERE i.indrelid = 'tenjikai_booth_plan'::regclass
      AND idx.relname = 'tenjikai_booth_plan_projectId_variant_idx'
      AND NOT i.indisunique AND NOT i.indisprimary AND i.indnkeyatts = 2
      AND (SELECT array_agg(a.attname::text ORDER BY key.ordinality)
           FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS key(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = key.attnum)
          = ARRAY['projectId', 'variant']
  ) THEN
    RAISE EXCEPTION 'TENJIKAI_OLD_PLAN_INDEX_UNKNOWN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'tenjikai_task'::regclass
      AND c.conname = 'tenjikai_task_documentId_fkey'
      AND c.contype = 'f' AND c.confrelid = 'tenjikai_document'::regclass
      AND c.confdeltype = 'n' AND c.confupdtype = 'c'
      AND (SELECT array_agg(a.attname::text ORDER BY key.ordinality)
           FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum)
          = ARRAY['documentId']
      AND (SELECT array_agg(a.attname::text ORDER BY key.ordinality)
           FROM unnest(c.confkey) WITH ORDINALITY AS key(attnum, ordinality)
           JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = key.attnum)
          = ARRAY['id']
  ) THEN
    RAISE EXCEPTION 'TENJIKAI_OLD_DOCUMENT_FK_UNKNOWN';
  END IF;
  IF EXISTS (SELECT 1 FROM tenjikai_booth_plan GROUP BY "projectId", variant HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'TENJIKAI_DUPLICATE_PLAN_VARIANT';
  END IF;
  IF EXISTS (SELECT 1 FROM tenjikai_creative GROUP BY "projectId", kind HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'TENJIKAI_DUPLICATE_CREATIVE_KIND';
  END IF;
  IF EXISTS (SELECT 1 FROM tenjikai_booth_plan WHERE selected GROUP BY "projectId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'TENJIKAI_MULTIPLE_SELECTED_PLANS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tenjikai_graphic_panel AS panel
    LEFT JOIN tenjikai_booth_element AS element
      ON element.id = panel."elementId" AND element."planId" = panel."planId"
    WHERE element.id IS NULL
  ) THEN
    RAISE EXCEPTION 'TENJIKAI_PANEL_ELEMENT_OUTSIDE_PLAN';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tenjikai_task AS task
    LEFT JOIN tenjikai_document AS doc
      ON doc.id = task."documentId" AND doc."projectId" = task."projectId"
    WHERE task."documentId" IS NOT NULL AND doc.id IS NULL
  ) THEN
    RAISE EXCEPTION 'TENJIKAI_TASK_DOCUMENT_OUTSIDE_PROJECT';
  END IF;
END $$;

DROP INDEX "tenjikai_booth_plan_projectId_variant_idx";
ALTER TABLE tenjikai_task DROP CONSTRAINT "tenjikai_task_documentId_fkey";

ALTER TABLE tenjikai_project
  ADD COLUMN "revision" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "workspaceSchemaVersion" INTEGER,
  ADD COLUMN "projectedVisitors" INTEGER,
  ADD COLUMN "planningVenueCode" TEXT,
  ADD COLUMN "planningVenueName" TEXT,
  ADD COLUMN "planningVenueNote" TEXT,
  ADD COLUMN "planningKomaSizeM" DOUBLE PRECISION,
  ADD COLUMN "planningKomaPriceYen" INTEGER,
  ADD COLUMN "planningMaxHeightM" DOUBLE PRECISION,
  ADD COLUMN "planningVenueSource" TEXT;
ALTER TABLE tenjikai_project
  ADD CONSTRAINT tenjikai_project_revision_nonnegative CHECK (revision >= 0);

ALTER TABLE tenjikai_site_analysis
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "generatedSource" TEXT,
  ADD COLUMN "generationNotice" TEXT,
  ADD COLUMN "generationOperationId" TEXT,
  ADD COLUMN "modelId" TEXT;

ALTER TABLE tenjikai_booth_plan
  ADD COLUMN "widthM" DOUBLE PRECISION,
  ADD COLUMN "depthM" DOUBLE PRECISION,
  ADD COLUMN "carpetYen" INTEGER,
  ADD COLUMN "designYen" INTEGER,
  ADD COLUMN "laborYen" INTEGER;
ALTER TABLE tenjikai_booth_element
  ADD COLUMN "sourceElementId" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE tenjikai_graphic_panel
  ADD COLUMN "sourcePanelId" TEXT,
  ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE tenjikai_creative
  ADD COLUMN "name" TEXT,
  ADD COLUMN "displaySize" TEXT,
  ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE tenjikai_novelty
  ADD COLUMN "sourceNoveltyId" TEXT,
  ADD COLUMN "recommended" BOOLEAN,
  ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE tenjikai_budget_line
  ADD COLUMN "sourceLineKey" TEXT,
  ADD COLUMN "sortOrder" INTEGER;
ALTER TABLE tenjikai_task
  ADD COLUMN "sourceDeadlineId" TEXT,
  ADD COLUMN "sortOrder" INTEGER;

CREATE UNIQUE INDEX tenjikai_booth_plan_project_variant_uq ON tenjikai_booth_plan ("projectId", variant);
CREATE UNIQUE INDEX tenjikai_booth_plan_one_selected_uq ON tenjikai_booth_plan ("projectId") WHERE selected;
CREATE UNIQUE INDEX tenjikai_booth_element_plan_id_uq ON tenjikai_booth_element ("planId", id);
CREATE UNIQUE INDEX tenjikai_booth_element_source_uq ON tenjikai_booth_element ("planId", "sourceElementId");
CREATE UNIQUE INDEX tenjikai_graphic_panel_source_uq ON tenjikai_graphic_panel ("planId", "sourcePanelId");
CREATE UNIQUE INDEX tenjikai_creative_project_kind_uq ON tenjikai_creative ("projectId", kind);
CREATE UNIQUE INDEX tenjikai_novelty_source_uq ON tenjikai_novelty ("projectId", "sourceNoveltyId");
CREATE UNIQUE INDEX tenjikai_budget_line_source_uq ON tenjikai_budget_line ("projectId", "sourceLineKey");
CREATE UNIQUE INDEX tenjikai_document_project_id_uq ON tenjikai_document ("projectId", id);
CREATE UNIQUE INDEX tenjikai_task_source_uq ON tenjikai_task ("projectId", "sourceDeadlineId");

ALTER TABLE tenjikai_graphic_panel
  ADD CONSTRAINT tenjikai_graphic_panel_element_same_plan_fkey
  FOREIGN KEY ("planId", "elementId") REFERENCES tenjikai_booth_element ("planId", id)
  ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE tenjikai_task
  ADD CONSTRAINT tenjikai_task_document_same_project_fkey
  FOREIGN KEY ("projectId", "documentId") REFERENCES tenjikai_document ("projectId", id)
  ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT;
