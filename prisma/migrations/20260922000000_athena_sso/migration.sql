-- Calytrix identity model switches from its own Auth.js (next-auth) accounts/
-- sessions to Athena's shared SSO (see src/lib/session.ts). `User.id` becomes
-- the Athena account id (an integer) instead of a locally generated cuid, and
-- the User row now optionally holds a connected GitHub authorization instead
-- of next-auth's generic Account/Session/VerificationToken tables.
--
-- NOTE: this is a breaking, non-backward-compatible cutover. Existing Review
-- rows reference the old next-auth `User.id` (a cuid string) via
-- `requestedById`, which cannot be mapped to an Athena account id. Since
-- reviews are just a cache keyed by PR head SHA (see src/lib/review.ts), they
-- are dropped here and will be regenerated on next request. If the production
-- database has reviews you want to keep, back them up before applying this
-- migration.

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_requestedById_fkey";

-- Drop cached reviews tied to the old (cuid) user ids; see NOTE above.
DELETE FROM "Review";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "VerificationToken";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL,
    "athenaUsername" TEXT NOT NULL,
    "githubLogin" TEXT,
    "githubUserId" BIGINT,
    "githubAccessToken" TEXT,
    "githubTokenScope" TEXT,
    "githubConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "requestedById" TYPE INTEGER USING ("requestedById"::integer);

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
