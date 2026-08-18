-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 30,
    "weekStartsOn" INTEGER NOT NULL DEFAULT 0,
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
    CONSTRAINT "ReminderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryLeadTime" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    CONSTRAINT "CategoryLeadTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenewalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT,
    "dueDate" TEXT NOT NULL,
    "costCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "recurrenceMonths" INTEGER,
    "leadTimeDaysOverride" INTEGER,
    "notes" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RenewalItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RenewalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenewalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "periodDueDate" TEXT NOT NULL,
    "renewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costCents" INTEGER,
    "notes" TEXT,
    CONSTRAINT "RenewalEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RenewalItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSettings_userId_key" ON "ReminderSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryLeadTime_userId_category_key" ON "CategoryLeadTime"("userId", "category");

-- CreateIndex
CREATE INDEX "RenewalItem_userId_dueDate_idx" ON "RenewalItem"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "RenewalItem_userId_category_idx" ON "RenewalItem"("userId", "category");

-- CreateIndex
CREATE INDEX "Document_itemId_idx" ON "Document"("itemId");

-- CreateIndex
CREATE INDEX "RenewalEvent_itemId_idx" ON "RenewalEvent"("itemId");
