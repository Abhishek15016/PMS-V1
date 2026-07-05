-- CreateTable
CREATE TABLE "placement_summaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "department_id" TEXT,
    "total_students" INTEGER NOT NULL,
    "eligible_count" INTEGER NOT NULL,
    "applied_count" INTEGER NOT NULL,
    "shortlisted_count" INTEGER NOT NULL,
    "selected_count" INTEGER NOT NULL,
    "placed_count" INTEGER NOT NULL,
    "unplaced_count" INTEGER NOT NULL,
    "highest_ctc" DECIMAL(65,30),
    "median_ctc" DECIMAL(65,30),
    "average_ctc" DECIMAL(65,30),
    "active_drive_count" INTEGER NOT NULL,
    "recruiter_count" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "placement_summaries_tenant_id_idx" ON "placement_summaries"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "placement_summaries_tenant_id_batch_id_department_id_key" ON "placement_summaries"("tenant_id", "batch_id", "department_id");

-- AddForeignKey
ALTER TABLE "placement_summaries" ADD CONSTRAINT "placement_summaries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_summaries" ADD CONSTRAINT "placement_summaries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "academic_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_summaries" ADD CONSTRAINT "placement_summaries_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same tenant_isolation pattern as every other tenant-scoped table (see
-- migration 20260702171635_init_tenant_user).
ALTER TABLE "placement_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "placement_summaries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "placement_summaries"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
