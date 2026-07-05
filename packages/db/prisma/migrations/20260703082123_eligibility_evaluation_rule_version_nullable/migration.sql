-- DropForeignKey
ALTER TABLE "eligibility_evaluations" DROP CONSTRAINT "eligibility_evaluations_rule_version_fkey";

-- AlterTable
ALTER TABLE "eligibility_evaluations" ALTER COLUMN "rule_version" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "eligibility_evaluations" ADD CONSTRAINT "eligibility_evaluations_rule_version_fkey" FOREIGN KEY ("rule_version") REFERENCES "policy_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
