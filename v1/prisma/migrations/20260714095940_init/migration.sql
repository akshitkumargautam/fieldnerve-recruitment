-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "operatingLocation" TEXT NOT NULL,
    "rating" DECIMAL NOT NULL,
    "safetyRating" DECIMAL NOT NULL,
    "currentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VendorDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "issuedDate" DATETIME,
    "expiryDate" DATETIME,
    "status" TEXT NOT NULL,
    CONSTRAINT "VendorDocument_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "estimatedValue" DECIMAL NOT NULL,
    "priority" TEXT NOT NULL,
    "expectedStartDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedVendorId" TEXT,
    "assignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkRequirement_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "Vendor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workRequirementId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiSummary" TEXT,
    CONSTRAINT "RecommendationRun_workRequirementId_fkey" FOREIGN KEY ("workRequirementId") REFERENCES "WorkRequirement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationRunId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "disqualificationReason" TEXT,
    "totalScore" DECIMAL,
    "scoreBreakdown" TEXT,
    "rank" INTEGER,
    CONSTRAINT "RecommendationResult_recommendationRunId_fkey" FOREIGN KEY ("recommendationRunId") REFERENCES "RecommendationRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecommendationResult_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorDocument_vendorId_documentType_key" ON "VendorDocument"("vendorId", "documentType");
