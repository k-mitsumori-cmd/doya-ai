-- Prepared only. Not applied to production. Verify target and apply approved statements individually.
CREATE TABLE "power_pack_purchases" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "companyId" TEXT NOT NULL REFERENCES "account_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "sourceKey" TEXT NOT NULL UNIQUE,
 "amount" INTEGER NOT NULL,
 "cancelTarget" INTEGER NOT NULL DEFAULT 0,
 "cashAmount" INTEGER,
 "cashRefunded" INTEGER,
 "paymentIntentId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "power_pack_purchases_amount_check" CHECK ("amount" > 0),
 CONSTRAINT "power_pack_purchases_target_check" CHECK ("cancelTarget" >= 0 AND "cancelTarget" <= "amount"),
 CONSTRAINT "power_pack_purchases_cash_amount_check" CHECK ("cashAmount" IS NULL OR "cashAmount" > 0),
 CONSTRAINT "power_pack_purchases_cash_refund_check" CHECK ("cashRefunded" IS NULL OR ("cashAmount" IS NOT NULL AND "cashRefunded" >= 0 AND "cashRefunded" <= "cashAmount"))
);
CREATE INDEX "power_pack_purchases_companyId_createdAt_idx" ON "power_pack_purchases"("companyId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "doya_power_grants_sourceKey_idx" ON "doya_power_grants"("sourceKey");
