-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_language_version_key" ON "legal_documents"("type", "language", "version");

-- CreateIndex
CREATE INDEX "legal_documents_type_language_isCurrent_idx" ON "legal_documents"("type", "language", "isCurrent");

-- CreateIndex
CREATE INDEX "legal_documents_type_language_version_idx" ON "legal_documents"("type", "language", "version" DESC);
