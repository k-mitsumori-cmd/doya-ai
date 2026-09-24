const { spawnSync } = require('node:child_process');
const path = require('node:path');
const hrEmployeeAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-employee-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEmployeeAdmission.error || hrEmployeeAdmission.status !== 0) {
  console.error('Security regression failed: verify-hr-employee-admission.cjs');
  process.exit(1);
}
const promaneWorkspaceAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-workspace-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneWorkspaceAdmission.error || promaneWorkspaceAdmission.status !== 0) {
  console.error('Security regression failed: verify-promane-workspace-admission.cjs');
  process.exit(1);
}
const mensetsuTemplateAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-template-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuTemplateAdmission.error || mensetsuTemplateAdmission.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-template-admission.cjs');
  process.exit(1);
}
const aishodanProductAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-product-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanProductAdmission.error || aishodanProductAdmission.status !== 0) {
  console.error('Security regression failed: verify-aishodan-product-admission.cjs');
  process.exit(1);
}
const mensetsuSessionAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-session-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuSessionAtomic.error || mensetsuSessionAtomic.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-session-atomic.cjs');
  process.exit(1);
}
const aishodanStartAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-room-start-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanStartAtomic.error || aishodanStartAtomic.status !== 0) {
  console.error('Security regression failed: verify-aishodan-room-start-atomic.cjs');
  process.exit(1);
}
const seoChatEditOwner = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-chat-edit-owner.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoChatEditOwner.error || seoChatEditOwner.status !== 0) {
  console.error('Security regression failed: verify-seo-chat-edit-owner.cjs');
  process.exit(1);
}
const seoCompetitorOwner = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-competitor-owner.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoCompetitorOwner.error || seoCompetitorOwner.status !== 0) {
  console.error('Security regression failed: verify-seo-competitor-owner.cjs');
  process.exit(1);
}
const seoSectionOwner = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-section-owner.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoSectionOwner.error || seoSectionOwner.status !== 0) {
  console.error('Security regression failed: verify-seo-section-owner.cjs');
  process.exit(1);
}
const seoEditorPreview = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-editor-preview.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoEditorPreview.error || seoEditorPreview.status !== 0) {
  console.error('Security regression failed: verify-seo-editor-preview.cjs');
  process.exit(1);
}
const mensetsuTemplateAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-template-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuTemplateAtomic.error || mensetsuTemplateAtomic.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-template-atomic.cjs');
  process.exit(1);
}
const hrInviteIdentity = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-invite-identity.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrInviteIdentity.error || hrInviteIdentity.status !== 0) {
  console.error('Security regression failed: verify-hr-invite-identity.cjs');
  process.exit(1);
}
const orgFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-org-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (orgFetch.error || orgFetch.status !== 0) {
  console.error('Security regression failed: verify-org-fetch.cjs');
  process.exit(1);
}
const aishodanSessionList = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-session-list.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanSessionList.error || aishodanSessionList.status !== 0) {
  console.error('Security regression failed: verify-aishodan-session-list.cjs');
  process.exit(1);
}
const orgSelection = spawnSync(process.execPath, [path.join(__dirname, 'verify-org-selection.cjs')], { stdio: 'inherit', timeout: 60000 });
if (orgSelection.error || orgSelection.status !== 0) {
  console.error('Security regression failed: verify-org-selection.cjs');
  process.exit(1);
}
const hrBillingOwner = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-billing-owner.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrBillingOwner.error || hrBillingOwner.status !== 0) {
  console.error('Security regression failed: verify-hr-billing-owner.cjs');
  process.exit(1);
}
const interviewListOutage = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-list-outage.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewListOutage.error || interviewListOutage.status !== 0) {
  console.error('Security regression failed: verify-interview-list-outage.cjs');
  process.exit(1);
}
const interviewStats = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-stats.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewStats.error || interviewStats.status !== 0) {
  console.error('Security regression failed: verify-interview-stats.cjs');
  process.exit(1);
}
const interviewProjectPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-project-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewProjectPagination.error || interviewProjectPagination.status !== 0) {
  console.error('Security regression failed: verify-interview-project-pagination.cjs');
  process.exit(1);
}
const interviewCleanup = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-cleanup.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewCleanup.error || interviewCleanup.status !== 0) {
  console.error('Security regression failed: verify-interview-cleanup.cjs');
  process.exit(1);
}
const interviewStorageQueue = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-storage-purge-queue.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewStorageQueue.error || interviewStorageQueue.status !== 0) {
  console.error('Security regression failed: verify-interview-storage-purge-queue.cjs');
  process.exit(1);
}
const interviewMaterialDelete = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-material-delete.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewMaterialDelete.error || interviewMaterialDelete.status !== 0) {
  console.error('Security regression failed: verify-interview-material-delete.cjs');
  process.exit(1);
}
const interviewUploadConfirm = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-upload-confirm.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewUploadConfirm.error || interviewUploadConfirm.status !== 0) {
  console.error('Security regression failed: verify-interview-upload-confirm.cjs');
  process.exit(1);
}
const interviewArticleLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-article-limit.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewArticleLimit.error || interviewArticleLimit.status !== 0) {
  console.error('Security regression failed: verify-interview-article-limit.cjs');
  process.exit(1);
}
const interviewRecipeInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-recipe-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewRecipeInput.error || interviewRecipeInput.status !== 0) {
  console.error('Security regression failed: verify-interview-recipe-input.cjs');
  process.exit(1);
}
const interviewGeminiRequest = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-gemini-request.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewGeminiRequest.error || interviewGeminiRequest.status !== 0) {
  console.error('Security regression failed: verify-interview-gemini-request.cjs');
  process.exit(1);
}
const aioClientLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-client-limit.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioClientLimit.error || aioClientLimit.status !== 0) {
  console.error('Security regression failed: verify-aio-client-limit.cjs');
  process.exit(1);
}
const seoArticleAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-article-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoArticleAdmission.error || seoArticleAdmission.status !== 0) {
  console.error('Security regression failed: verify-seo-article-admission.cjs');
  process.exit(1);
}
const seoTemplateAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-template-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoTemplateAdmission.error || seoTemplateAdmission.status !== 0) {
  console.error('Security regression failed: verify-seo-template-admission.cjs');
  process.exit(1);
}
const seoCreateAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-create-route-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoCreateAdmission.error || seoCreateAdmission.status !== 0) {
  console.error('Security regression failed: verify-seo-create-route-admission.cjs');
  process.exit(1);
}
const seoEntitlementsLedger = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-entitlements-ledger.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoEntitlementsLedger.error || seoEntitlementsLedger.status !== 0) {
  console.error('Security regression failed: verify-seo-entitlements-ledger.cjs');
  process.exit(1);
}
const kintaiOvernight = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-overnight.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiOvernight.error || kintaiOvernight.status !== 0) {
  console.error('Security regression failed: verify-kintai-overnight.cjs');
  process.exit(1);
}
const kintaiOvernightCorrection = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-overnight-correction.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiOvernightCorrection.error || kintaiOvernightCorrection.status !== 0) {
  console.error('Security regression failed: verify-kintai-overnight-correction.cjs');
  process.exit(1);
}
const kintaiCorrectionAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-correction-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiCorrectionAdmission.error || kintaiCorrectionAdmission.status !== 0) {
  console.error('Security regression failed: verify-kintai-correction-admission.cjs');
  process.exit(1);
}
const interviewUsageMonth = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-usage-month.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewUsageMonth.error || interviewUsageMonth.status !== 0) {
  console.error('Security regression failed: verify-interview-usage-month.cjs');
  process.exit(1);
}
const interviewMediaDuration = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-media-duration.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewMediaDuration.error || interviewMediaDuration.status !== 0) {
  console.error('Security regression failed: verify-interview-media-duration.cjs');
  process.exit(1);
}
const interviewTranscriptionBudget = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-transcription-budget.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewTranscriptionBudget.error || interviewTranscriptionBudget.status !== 0) {
  console.error('Security regression failed: verify-interview-transcription-budget.cjs');
  process.exit(1);
}
const interviewTranscriptionAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-transcription-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewTranscriptionAdmission.error || interviewTranscriptionAdmission.status !== 0) {
  console.error('Security regression failed: verify-interview-transcription-admission.cjs');
  process.exit(1);
}
const interviewTranscriptionRecovery = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-transcription-recovery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewTranscriptionRecovery.error || interviewTranscriptionRecovery.status !== 0) {
  console.error('Security regression failed: verify-interview-transcription-recovery.cjs');
  process.exit(1);
}
const interviewTranscriptionProvider = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-transcription-provider.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewTranscriptionProvider.error || interviewTranscriptionProvider.status !== 0) {
  console.error('Security regression failed: verify-interview-transcription-provider.cjs');
  process.exit(1);
}
const bannerAdmissionRoute = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-admission-route.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerAdmissionRoute.error || bannerAdmissionRoute.status !== 0) {
  console.error('Security regression failed: verify-banner-admission-route.cjs');
  process.exit(1);
}
const bannerMonthlyQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-monthly-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerMonthlyQuota.error || bannerMonthlyQuota.status !== 0) {
  console.error('Security regression failed: verify-banner-monthly-quota.cjs');
  process.exit(1);
}
const serviceMetadata = spawnSync(process.execPath, [path.join(__dirname, 'verify-service-metadata.cjs')], { stdio: 'inherit', timeout: 60000 });
if (serviceMetadata.error || serviceMetadata.status !== 0) {
  console.error('Security regression failed: verify-service-metadata.cjs');
  process.exit(1);
}
const adminBannerQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-banner-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminBannerQuota.error || adminBannerQuota.status !== 0) {
  console.error('Security regression failed: verify-admin-banner-quota.cjs');
  process.exit(1);
}
const navigation = spawnSync(process.execPath, [path.join(__dirname, 'verify-active-service-navigation.cjs')], { stdio: 'inherit', timeout: 60000 });
if (navigation.error || navigation.status !== 0) {
  console.error('Security regression failed: verify-active-service-navigation.cjs');
  process.exit(1);
}
const sfaDealsPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-deals-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaDealsPagination.error || sfaDealsPagination.status !== 0) {
  console.error('Security regression failed: verify-sfa-deals-pagination.cjs');
  process.exit(1);
}
const sfaAmountInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-amount-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaAmountInput.error || sfaAmountInput.status !== 0) {
  console.error('Security regression failed: verify-sfa-amount-input.cjs');
  process.exit(1);
}
const sfaCrmPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-crm-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaCrmPagination.error || sfaCrmPagination.status !== 0) {
  console.error('Security regression failed: verify-sfa-crm-pagination.cjs');
  process.exit(1);
}
const sfaBasicCreateInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-basic-create-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaBasicCreateInput.error || sfaBasicCreateInput.status !== 0) {
  console.error('Security regression failed: verify-sfa-basic-create-input.cjs');
  process.exit(1);
}
const sfaScoreAccess = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-score-access.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaScoreAccess.error || sfaScoreAccess.status !== 0) {
  console.error('Security regression failed: verify-sfa-score-access.cjs');
  process.exit(1);
}
const sfaLeadImport = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-lead-import.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaLeadImport.error || sfaLeadImport.status !== 0) {
  console.error('Security regression failed: verify-sfa-lead-import.cjs');
  process.exit(1);
}
const sfaLeadCsv = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-lead-csv.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaLeadCsv.error || sfaLeadCsv.status !== 0) {
  console.error('Security regression failed: verify-sfa-lead-csv.cjs');
  process.exit(1);
}
const sfaOrganizationCreate = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-organization-create.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaOrganizationCreate.error || sfaOrganizationCreate.status !== 0) {
  console.error('Security regression failed: verify-sfa-organization-create.cjs');
  process.exit(1);
}
const siblingOnboarding = spawnSync(process.execPath, [path.join(__dirname, 'verify-onboarding-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (siblingOnboarding.error || siblingOnboarding.status !== 0) {
  console.error('Security regression failed: verify-onboarding-atomic.cjs');
  process.exit(1);
}
const secondaryOnboarding = spawnSync(process.execPath, [path.join(__dirname, 'verify-secondary-onboarding.cjs')], { stdio: 'inherit', timeout: 60000 });
if (secondaryOnboarding.error || secondaryOnboarding.status !== 0) {
  console.error('Security regression failed: verify-secondary-onboarding.cjs');
  process.exit(1);
}
const hrKintaiOnboarding = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-kintai-onboarding.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrKintaiOnboarding.error || hrKintaiOnboarding.status !== 0) {
  console.error('Security regression failed: verify-hr-kintai-onboarding.cjs');
  process.exit(1);
}
const hrOrganizationUpdates = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-organization-updates.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrOrganizationUpdates.error || hrOrganizationUpdates.status !== 0) {
  console.error('Security regression failed: verify-hr-organization-updates.cjs');
  process.exit(1);
}
const teamInviteDelivery = spawnSync(process.execPath, [path.join(__dirname, 'verify-team-invite-delivery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (teamInviteDelivery.error || teamInviteDelivery.status !== 0) {
  console.error('Security regression failed: verify-team-invite-delivery.cjs');
  process.exit(1);
}
const doyaslideRegeneration = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-regeneration-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideRegeneration.error || doyaslideRegeneration.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-regeneration-atomic.cjs');
  process.exit(1);
}
const doyaslideBatchAccounting = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-batch-accounting.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideBatchAccounting.error || doyaslideBatchAccounting.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-batch-accounting.cjs');
  process.exit(1);
}
const serviceInputTypes = spawnSync(process.execPath, [path.join(__dirname, 'verify-service-input-types.cjs')], { stdio: 'inherit', timeout: 60000 });
if (serviceInputTypes.error || serviceInputTypes.status !== 0) {
  console.error('Security regression failed: verify-service-input-types.cjs');
  process.exit(1);
}
const cunningKnowledgeLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-cunning-knowledge-limit-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (cunningKnowledgeLimit.error || cunningKnowledgeLimit.status !== 0) {
  console.error('Security regression failed: verify-cunning-knowledge-limit-atomic.cjs');
  process.exit(1);
}
const doyaslideProjectLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-project-limit-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideProjectLimit.error || doyaslideProjectLimit.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-project-limit-atomic.cjs');
  process.exit(1);
}
const doyaslideMonthlyQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-monthly-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideMonthlyQuota.error || doyaslideMonthlyQuota.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-monthly-quota.cjs');
  process.exit(1);
}
const doyaslideStructureSafety = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-structure-safety.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideStructureSafety.error || doyaslideStructureSafety.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-structure-safety.cjs');
  process.exit(1);
}
const kintaiInviteAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-invite-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiInviteAtomic.error || kintaiInviteAtomic.status !== 0) {
  console.error('Security regression failed: verify-kintai-invite-atomic.cjs');
  process.exit(1);
}
const sfaLeadsPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-leads-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaLeadsPagination.error || sfaLeadsPagination.status !== 0) {
  console.error('Security regression failed: verify-sfa-leads-pagination.cjs');
  process.exit(1);
}
const sfaActivitiesPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-activities-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaActivitiesPagination.error || sfaActivitiesPagination.status !== 0) {
  console.error('Security regression failed: verify-sfa-activities-pagination.cjs');
  process.exit(1);
}
const sfaActivityRelations = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-activity-relations.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaActivityRelations.error || sfaActivityRelations.status !== 0) {
  console.error('Security regression failed: verify-sfa-activity-relations.cjs');
  process.exit(1);
}
const sfaActivitiesUi = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-activities-ui.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaActivitiesUi.error || sfaActivitiesUi.status !== 0) {
  console.error('Security regression failed: verify-sfa-activities-ui.cjs');
  process.exit(1);
}
const sfaLeadsUi = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-leads-ui.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaLeadsUi.error || sfaLeadsUi.status !== 0) {
  console.error('Security regression failed: verify-sfa-leads-ui.cjs');
  process.exit(1);
}
const sfaDealsUi = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-deals-ui.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaDealsUi.error || sfaDealsUi.status !== 0) {
  console.error('Security regression failed: verify-sfa-deals-ui.cjs');
  process.exit(1);
}
const sfaDealTasksUi = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-deal-tasks-ui.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaDealTasksUi.error || sfaDealTasksUi.status !== 0) {
  console.error('Security regression failed: verify-sfa-deal-tasks-ui.cjs');
  process.exit(1);
}
const sfaTaskCreate = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-task-create.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaTaskCreate.error || sfaTaskCreate.status !== 0) {
  console.error('Security regression failed: verify-sfa-task-create.cjs');
  process.exit(1);
}
const sfaExportAll = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-export-all.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaExportAll.error || sfaExportAll.status !== 0) {
  console.error('Security regression failed: verify-sfa-export-all.cjs');
  process.exit(1);
}
const doyalistCollectionQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-collection-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistCollectionQuota.error || doyalistCollectionQuota.status !== 0) {
  console.error('Security regression failed: verify-doyalist-collection-quota.cjs');
  process.exit(1);
}
const doyalistApproachQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-approach-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistApproachQuota.error || doyalistApproachQuota.status !== 0) {
  console.error('Security regression failed: verify-doyalist-approach-quota.cjs');
  process.exit(1);
}
const doyalistHelperInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-helper-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistHelperInput.error || doyalistHelperInput.status !== 0) {
  console.error('Security regression failed: verify-doyalist-helper-input.cjs');
  process.exit(1);
}
for (const file of ['verify-hr-usage-error.cjs', 'verify-doyalist-layout-plan.cjs', 'verify-doyalist-pricing-status.cjs', 'verify-kintai-usage-error.cjs', 'verify-service-plan-fallback.cjs', 'verify-doyaslide-load-errors.cjs', 'verify-cunning-load-errors.cjs', 'verify-aishodan-stats-all.cjs', 'verify-promane-invitation-ui.cjs', 'verify-promane-invitation-pages.cjs', 'verify-mensetsu-compare-ui.cjs', 'verify-mensetsu-compare-pages.cjs', 'verify-adimage-concept-pages.cjs', 'verify-doyalist-history-ui.cjs', 'verify-doyalist-approach-pages.cjs', 'verify-cunning-profile-pages.cjs', 'verify-aishodan-list-pages.cjs', 'verify-kintai-request-pagination.cjs', 'verify-kintai-employee-pages.cjs', 'verify-shodan-preparation-pages.cjs', 'verify-shodan-quota-atomic.cjs', 'verify-sfa-lead-update.cjs', 'verify-dependency-floor.cjs', 'verify-auth-adimage.cjs', 'verify-safe-fetch.cjs', 'verify-doyalist-export-all.cjs', 'verify-doyalist-scraper.cjs', 'verify-doyaslide-scrape.cjs', 'verify-seo-reference.cjs', 'verify-safe-browser.cjs', 'verify-banner-safe-url.cjs', 'verify-banner-thumb-access.cjs', 'verify-banner-history-retention.cjs', 'verify-banner-account-cache.cjs', 'notification-security.cjs', 'verify-data-integrity.cjs', 'verify-billing-integrity.cjs', 'verify-related-records.cjs', 'verify-admin-billing-integrity.cjs', 'verify-prompt-migration-auth.cjs', 'verify-retired-db-sync.cjs', 'verify-seo-schema-readiness.cjs', 'verify-owner-boundaries.cjs', 'verify-banner-quota.cjs', 'verify-service-limit-ui.cjs', 'verify-promane-write-access.cjs', 'verify-kintai-employee-atomic.cjs', 'verify-kintai-toggle.cjs', 'verify-kintai-disabled-clock.cjs', 'verify-sfa-elapsed.cjs', 'verify-sfa-activity-order.cjs', 'verify-quote-list-pagination.cjs', 'verify-quote-issuer-load.cjs', 'verify-quote-confirm-response.cjs', 'verify-quote-status-transition.cjs', 'verify-quote-atomic-save.cjs', 'verify-quote-money.cjs', 'verify-quote-pdf-ui.cjs', 'verify-quote-provenance.cjs', 'verify-quote-create-atomic.cjs', 'verify-quote-text-limits.cjs', 'verify-sfa-task-delete.cjs', 'verify-sfa-task-input.cjs', 'verify-sfa-task-update.cjs', 'verify-sfa-create-stage.cjs', 'verify-sfa-convert.cjs', 'verify-hr-finalized.cjs', 'verify-hr-evaluation-read.cjs', 'verify-hr-evaluation-list.cjs', 'verify-hr-evaluation-related-reads.cjs', 'verify-hr-evaluation-ai.cjs', 'verify-hr-evaluation-write.cjs', 'verify-hr-rating-fields.cjs', 'verify-hr-ai-save-first.cjs', 'verify-hr-form-locks.cjs', 'verify-hr-evaluation-create-access.cjs', 'verify-doyalist-collect-preservation.cjs', 'verify-interview-autosave.cjs', 'verify-interview-save-conflict.cjs', 'verify-interview-title-save.cjs', 'verify-sfa-task-pagination.cjs', 'verify-hr-one-on-one-roundtrip.cjs', 'verify-hr-one-on-one-input.cjs', 'verify-hr-one-on-one-summary-flow.cjs', 'verify-hr-one-on-one-access.cjs', 'verify-hr-one-on-one-related.cjs', 'verify-hr-one-on-one-create-private.cjs', 'verify-hr-one-on-one-pagination.cjs', 'verify-hr-one-on-one-list-ui.cjs', 'verify-hr-one-on-one-date.cjs', 'verify-hr-one-on-one-navigation.cjs', 'verify-cancellation-partial.cjs', 'verify-stripe-discovery.cjs', 'verify-trial-failure.cjs', 'verify-subscription-resume.cjs', 'verify-subscription-status.cjs', 'verify-seo-content-owner.cjs', 'verify-seo-memo-outline.cjs', 'verify-seo-export-owner.cjs', 'verify-seo-check-owner.cjs', 'verify-seo-check-persistence.cjs', 'verify-seo-generation-owner.cjs', 'verify-seo-images-owner.cjs', 'verify-seo-batch-results.cjs', 'verify-seo-storage-collision.cjs', 'verify-seo-image-read.cjs', 'verify-seo-storage-boundary.cjs', 'verify-seo-editor-save.cjs', 'verify-seo-editor-navigation.cjs', 'verify-seo-article-access.cjs', 'verify-seo-job-restart.cjs', 'verify-seo-candidates.cjs', 'verify-seo-job-vibe-owner.cjs', 'verify-seo-job-controls.cjs', 'verify-seo-pipeline-stop.cjs', 'verify-seo-job-ui.cjs', 'verify-seo-job-cancel-ui.cjs', 'verify-seo-job-response.cjs', 'verify-seo-list-read.cjs', 'verify-evaluation-lifecycle.cjs', 'verify-mensetsu-session-pages.cjs', 'verify-mensetsu-turn-order.cjs', 'verify-aishodan-end-once.cjs', 'verify-aishodan-token-state.cjs', 'verify-mensetsu-turn-metadata.cjs', 'verify-shodan-slide-save.cjs', 'verify-shodan-proposal-save.cjs', 'verify-shodan-slide-completeness.cjs', 'verify-shodan-pdf-action.cjs', 'verify-persona-image-owner.cjs', 'verify-persona-plan-cta.cjs', 'verify-aio-plan-cta.cjs', 'verify-adimage-response-owner.cjs', 'verify-doyaslide-revert.cjs', 'verify-promane-time-project.cjs', 'verify-promane-timesheet-query.cjs', 'verify-promane-time-input.cjs', 'verify-promane-expense-input.cjs', 'verify-promane-numeric-fields.cjs', 'verify-promane-project-dates.cjs', 'verify-promane-project-text.cjs', 'verify-promane-project-quota.cjs', 'verify-promane-project-update-atomic.cjs', 'verify-promane-project-repair.cjs', 'verify-promane-report-values.cjs', 'verify-kintai-correction-atomic.cjs', 'verify-kintai-request-read.cjs', 'verify-kintai-work-intervals.cjs', 'verify-kintai-clock-atomic.cjs', 'verify-kintai-clock-order.cjs', 'verify-kintai-read-only.cjs', 'verify-kintai-leave-approval.cjs', 'verify-kintai-leave-cancel.cjs', 'verify-aio-missing-measurements.cjs', 'verify-aio-quota.cjs', 'verify-cunning-transcribe-gate.cjs', 'verify-cunning-allowance.cjs', 'verify-cunning-cumulative-ui.cjs', 'verify-cunning-final-audio.cjs', 'verify-cunning-final-audio-retry.cjs', 'verify-cunning-report-complete.cjs', 'verify-cunning-report-recovery.cjs', 'verify-cunning-revision.cjs', 'verify-cunning-report-freshness.cjs', 'verify-cunning-history.cjs', 'verify-cunning-history-list.cjs', 'verify-adimage-export.cjs', 'verify-sfa-summary.cjs', 'verify-adimage-quota-reasons.cjs', 'verify-persona-account-storage.cjs', 'verify-persona-restore-images.cjs', 'verify-persona-history-images.cjs', 'verify-persona-history-delete.cjs', 'verify-persona-image-access.cjs', 'verify-persona-scene-retry.cjs', 'verify-persona-safe-url.cjs', 'verify-persona-image-entitlements.cjs', 'verify-persona-image-storage.cjs', 'verify-persona-image-timeouts.cjs', 'verify-persona-banner-size.cjs', 'verify-persona-plan-limits.cjs', 'verify-persona-project-history.cjs', 'verify-persona-live-access.cjs', 'verify-persona-result-schema.cjs', 'verify-persona-display-data.cjs', 'verify-persona-image-purge.cjs', 'verify-cunning-session-input.cjs', 'verify-cunning-usage-interval.cjs', 'verify-cunning-recording-api.cjs', 'verify-cunning-audio-protocol.cjs', 'verify-cunning-final-answer.cjs', 'verify-cunning-answer-language.cjs', 'verify-cunning-live-view.cjs', 'verify-cunning-live-history.cjs', 'verify-cunning-recording-client.cjs', 'verify-cunning-audio-window-client.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) {
    console.error(`Security regression failed: ${file}`);
    process.exit(1);
  }
}
