-- Student profile links + mentor opt-in
ALTER TABLE "students" ADD COLUMN "linkedin_url" TEXT;
ALTER TABLE "students" ADD COLUMN "github_url" TEXT;
ALTER TABLE "students" ADD COLUMN "leetcode_url" TEXT;
ALTER TABLE "students" ADD COLUMN "codeforces_url" TEXT;
ALTER TABLE "students" ADD COLUMN "mentor_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN "mentor_headline" TEXT;

-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'ANSWERED');

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_threads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "author_student_id" TEXT NOT NULL,
    "mentor_student_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_replies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumes_student_id_key" ON "resumes"("student_id");
CREATE INDEX "resumes_tenant_id_idx" ON "resumes"("tenant_id");
CREATE INDEX "mentor_threads_tenant_id_idx" ON "mentor_threads"("tenant_id");
CREATE INDEX "mentor_threads_tenant_id_status_idx" ON "mentor_threads"("tenant_id", "status");
CREATE INDEX "mentor_replies_tenant_id_idx" ON "mentor_replies"("tenant_id");
CREATE INDEX "mentor_replies_tenant_id_thread_id_idx" ON "mentor_replies"("tenant_id", "thread_id");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_author_student_id_fkey" FOREIGN KEY ("author_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_mentor_student_id_fkey" FOREIGN KEY ("mentor_student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_replies" ADD CONSTRAINT "mentor_replies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_replies" ADD CONSTRAINT "mentor_replies_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mentor_threads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mentor_replies" ADD CONSTRAINT "mentor_replies_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RowLevelSecurity
-- Same tenant_isolation pattern as migration 20260702171635_init_tenant_user,
-- applied to every tenant-scoped table this migration adds.
ALTER TABLE "resumes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resumes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "resumes"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "mentor_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentor_threads" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mentor_threads"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "mentor_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentor_replies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "mentor_replies"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Grants (explicit, matching 20260703072742_core_schema — default privileges
-- also cover these, but only when the migration runs as the role that set
-- them, which isn't guaranteed across environments).
GRANT SELECT, INSERT, UPDATE, DELETE ON "resumes", "mentor_threads", "mentor_replies" TO pms_app;
