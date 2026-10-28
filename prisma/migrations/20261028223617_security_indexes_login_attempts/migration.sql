-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "Adjustment_studentId_idx" ON "Adjustment"("studentId");

-- CreateIndex
CREATE INDEX "Adjustment_invoiceId_idx" ON "Adjustment"("invoiceId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_intendedClassId_idx" ON "AdmissionApplication"("intendedClassId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_yearId_idx" ON "AdmissionApplication"("yearId");

-- CreateIndex
CREATE INDEX "AssessmentConfig_classId_idx" ON "AssessmentConfig"("classId");

-- CreateIndex
CREATE INDEX "AssessmentConfig_yearId_idx" ON "AssessmentConfig"("yearId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_studentId_idx" ON "ClassEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_classId_idx" ON "ClassEnrollment"("classId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_yearId_idx" ON "ClassEnrollment"("yearId");

-- CreateIndex
CREATE INDEX "ClassRoom_teacherId_idx" ON "ClassRoom"("teacherId");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");

-- CreateIndex
CREATE INDEX "Invoice_applicationId_idx" ON "Invoice"("applicationId");

-- CreateIndex
CREATE INDEX "Invoice_yearId_idx" ON "Invoice"("yearId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "MarkRow_sheetId_idx" ON "MarkRow"("sheetId");

-- CreateIndex
CREATE INDEX "MarkRow_studentId_idx" ON "MarkRow"("studentId");

-- CreateIndex
CREATE INDEX "MarkSheet_configId_idx" ON "MarkSheet"("configId");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "Payment_applicationId_idx" ON "Payment"("applicationId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "ReportCardSnapshot_studentId_idx" ON "ReportCardSnapshot"("studentId");

-- CreateIndex
CREATE INDEX "ResultEvent_sheetId_idx" ON "ResultEvent"("sheetId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_staffId_idx" ON "TeacherAssignment"("staffId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_classId_idx" ON "TeacherAssignment"("classId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_yearId_idx" ON "TeacherAssignment"("yearId");

-- CreateIndex
CREATE INDEX "Term_yearId_idx" ON "Term"("yearId");
