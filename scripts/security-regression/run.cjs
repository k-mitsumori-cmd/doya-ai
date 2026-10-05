const { spawnSync } = require('node:child_process');
const path = require('node:path');
const doyaslideLogoConfig = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-logo-config.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideLogoConfig.error || doyaslideLogoConfig.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-logo-config.cjs');
  process.exit(1);
}
const aishodanRoomInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-room-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanRoomInput.error || aishodanRoomInput.status !== 0) {
  console.error('Security regression failed: verify-aishodan-room-input.cjs');
  process.exit(1);
}
const aishodanArchiveWrite = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-archive-write-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanArchiveWrite.error || aishodanArchiveWrite.status !== 0) {
  console.error('Security regression failed: verify-aishodan-archive-write-atomic.cjs');
  process.exit(1);
}
const shodanDeleteQuota = spawnSync(process.execPath, [path.join(__dirname, 'verify-shodan-delete-quota.cjs')], { stdio: 'inherit', timeout: 60000 });
if (shodanDeleteQuota.error || shodanDeleteQuota.status !== 0) {
  console.error('Security regression failed: verify-shodan-delete-quota.cjs');
  process.exit(1);
}
const aioPromptArchive = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-prompt-archive.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioPromptArchive.error || aioPromptArchive.status !== 0) {
  console.error('Security regression failed: verify-aio-prompt-archive.cjs');
  process.exit(1);
}
const adbannerCopyPlanCta = spawnSync(process.execPath, [path.join(__dirname, 'verify-adbanner-copy-plan-cta.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adbannerCopyPlanCta.error || adbannerCopyPlanCta.status !== 0) {
  console.error('Security regression failed: verify-adbanner-copy-plan-cta.cjs');
  process.exit(1);
}
const personaUsagePlanLabel = spawnSync(process.execPath, [path.join(__dirname, 'verify-persona-usage-plan-label.cjs')], { stdio: 'inherit', timeout: 60000 });
if (personaUsagePlanLabel.error || personaUsagePlanLabel.status !== 0) {
  console.error('Security regression failed: verify-persona-usage-plan-label.cjs');
  process.exit(1);
}
const adimagePlanAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-adimage-plan-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adimagePlanAdmission.error || adimagePlanAdmission.status !== 0) {
  console.error('Security regression failed: verify-adimage-plan-admission.cjs');
  process.exit(1);
}
const planChange = spawnSync(process.execPath, [path.join(__dirname, 'verify-plan-change.cjs')], { stdio: 'inherit', timeout: 60000 });
if (planChange.error || planChange.status !== 0) {
  console.error('Security regression failed: verify-plan-change.cjs');
  process.exit(1);
}
const checkoutReservation = spawnSync(process.execPath, [path.join(__dirname, 'verify-checkout-reservation.cjs')], { stdio: 'inherit', timeout: 60000 });
if (checkoutReservation.error || checkoutReservation.status !== 0) {
  console.error('Security regression failed: verify-checkout-reservation.cjs');
  process.exit(1);
}
const adimageLogoAvailability = spawnSync(process.execPath, [path.join(__dirname, 'verify-adimage-logo-availability.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adimageLogoAvailability.error || adimageLogoAvailability.status !== 0) {
  console.error('Security regression failed: verify-adimage-logo-availability.cjs');
  process.exit(1);
}
const shodanSourceStatus = spawnSync(process.execPath, [path.join(__dirname, 'verify-shodan-source-status.cjs')], { stdio: 'inherit', timeout: 60000 });
if (shodanSourceStatus.error || shodanSourceStatus.status !== 0) {
  console.error('Security regression failed: verify-shodan-source-status.cjs');
  process.exit(1);
}
const hrOneOnOneMonth = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-one-on-one-month.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrOneOnOneMonth.error || hrOneOnOneMonth.status !== 0) {
  console.error('Security regression failed: verify-hr-one-on-one-month.cjs');
  process.exit(1);
}
const hrLoadErrorUi = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-load-error-ui.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrLoadErrorUi.error || hrLoadErrorUi.status !== 0) {
  console.error('Security regression failed: verify-hr-load-error-ui.cjs');
  process.exit(1);
}
const signInCallback = spawnSync(process.execPath, [path.join(__dirname, 'verify-signin-callback.cjs')], { stdio: 'inherit', timeout: 60000 });
if (signInCallback.error || signInCallback.status !== 0) {
  console.error('Security regression failed: verify-signin-callback.cjs');
  process.exit(1);
}
const organizationBilling = spawnSync(process.execPath, [path.join(__dirname, 'verify-organization-billing.cjs')], { stdio: 'inherit', timeout: 60000 });
if (organizationBilling.error || organizationBilling.status !== 0) {
  console.error('Security regression failed: verify-organization-billing.cjs');
  process.exit(1);
}
const interviewAuxBudget = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-aux-budget.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewAuxBudget.error || interviewAuxBudget.status !== 0) {
  console.error('Security regression failed: verify-interview-aux-budget.cjs');
  process.exit(1);
}
const hrEvaluationPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-evaluation-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEvaluationPagination.error || hrEvaluationPagination.status !== 0) {
  console.error('Security regression failed: verify-hr-evaluation-pagination.cjs');
  process.exit(1);
}
const hrAuditPagination = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-audit-pagination.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrAuditPagination.error || hrAuditPagination.status !== 0) {
  console.error('Security regression failed: verify-hr-audit-pagination.cjs');
  process.exit(1);
}
const doyaSlideProjectPages = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-project-pages.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaSlideProjectPages.error || doyaSlideProjectPages.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-project-pages.cjs');
  process.exit(1);
}
const interviewAiOutput = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-ai-output.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewAiOutput.error || interviewAiOutput.status !== 0) {
  console.error('Security regression failed: verify-interview-ai-output.cjs');
  process.exit(1);
}
const interviewRecipeBudget = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-recipe-budget.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewRecipeBudget.error || interviewRecipeBudget.status !== 0) {
  console.error('Security regression failed: verify-interview-recipe-budget.cjs');
  process.exit(1);
}
const bannerTextBudget = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-text-budget.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTextBudget.error || bannerTextBudget.status !== 0) {
  console.error('Security regression failed: verify-banner-text-budget.cjs');
  process.exit(1);
}
const bannerTextProviderResponse = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-text-provider-response.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTextProviderResponse.error || bannerTextProviderResponse.status !== 0) {
  console.error('Security regression failed: verify-banner-text-provider-response.cjs');
  process.exit(1);
}
const bannerErrorBoundaries = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-error-boundaries.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerErrorBoundaries.error || bannerErrorBoundaries.status !== 0) {
  console.error('Security regression failed: verify-banner-error-boundaries.cjs');
  process.exit(1);
}
const errorNotificationPrivacy = spawnSync(process.execPath, [path.join(__dirname, 'verify-error-notification-privacy.cjs')], { stdio: 'inherit', timeout: 60000 });
if (errorNotificationPrivacy.error || errorNotificationPrivacy.status !== 0) {
  console.error('Security regression failed: verify-error-notification-privacy.cjs');
  process.exit(1);
}
const apiErrorLogPrivacy = spawnSync(process.execPath, [path.join(__dirname, 'verify-api-error-log-privacy.cjs')], { stdio: 'inherit', timeout: 60000 });
if (apiErrorLogPrivacy.error || apiErrorLogPrivacy.status !== 0) {
  console.error('Security regression failed: verify-api-error-log-privacy.cjs');
  process.exit(1);
}
const apiErrorResponsePrivacy = spawnSync(process.execPath, [path.join(__dirname, 'verify-api-error-response-privacy.cjs')], { stdio: 'inherit', timeout: 60000 });
if (apiErrorResponsePrivacy.error || apiErrorResponsePrivacy.status !== 0) {
  console.error('Security regression failed: verify-api-error-response-privacy.cjs');
  process.exit(1);
}
const emailErrorPrivacy = spawnSync(process.execPath, [path.join(__dirname, 'verify-email-error-privacy.cjs')], { stdio: 'inherit', timeout: 60000 });
if (emailErrorPrivacy.error || emailErrorPrivacy.status !== 0) {
  console.error('Security regression failed: verify-email-error-privacy.cjs');
  process.exit(1);
}
const bannerGalleryPages = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-gallery-pages.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerGalleryPages.error || bannerGalleryPages.status !== 0) {
  console.error('Security regression failed: verify-banner-gallery-pages.cjs');
  process.exit(1);
}
const doyamanaCreate = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyamana-admin-create.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyamanaCreate.error || doyamanaCreate.status !== 0) {
  console.error('Security regression failed: verify-doyamana-admin-create.cjs');
  process.exit(1);
}
const doyamanaCategories = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyamana-categories.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyamanaCategories.error || doyamanaCategories.status !== 0) {
  console.error('Security regression failed: verify-doyamana-categories.cjs');
  process.exit(1);
}
const hubspotSyncRetry = spawnSync(process.execPath, [path.join(__dirname, 'verify-hubspot-sync-retry.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hubspotSyncRetry.error || hubspotSyncRetry.status !== 0) {
  console.error('Security regression failed: verify-hubspot-sync-retry.cjs');
  process.exit(1);
}
const doyamanaAdminErrors = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyamana-admin-errors.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyamanaAdminErrors.error || doyamanaAdminErrors.status !== 0) {
  console.error('Security regression failed: verify-doyamana-admin-errors.cjs');
  process.exit(1);
}
const doyaslideErrorDebug = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-error-debug.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideErrorDebug.error || doyaslideErrorDebug.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-error-debug.cjs');
  process.exit(1);
}
const doyaslideTextBudget = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-text-budget.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideTextBudget.error || doyaslideTextBudget.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-text-budget.cjs');
  process.exit(1);
}
const doyaslideProjectUpdate = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-project-update.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideProjectUpdate.error || doyaslideProjectUpdate.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-project-update.cjs');
  process.exit(1);
}
const bannerRefineCronErrors = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-refine-cron-errors.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerRefineCronErrors.error || bannerRefineCronErrors.status !== 0) {
  console.error('Security regression failed: verify-banner-refine-cron-errors.cjs');
  process.exit(1);
}
const bannerMaintenanceBatch = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-maintenance-batch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerMaintenanceBatch.error || bannerMaintenanceBatch.status !== 0) {
  console.error('Security regression failed: verify-banner-maintenance-batch.cjs');
  process.exit(1);
}
const adminTemplateErrors = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-template-errors.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminTemplateErrors.error || adminTemplateErrors.status !== 0) {
  console.error('Security regression failed: verify-admin-template-errors.cjs');
  process.exit(1);
}
const privateUsageResponses = spawnSync(process.execPath, [path.join(__dirname, 'verify-private-usage-responses.cjs')], { stdio: 'inherit', timeout: 60000 });
if (privateUsageResponses.error || privateUsageResponses.status !== 0) {
  console.error('Security regression failed: verify-private-usage-responses.cjs');
  process.exit(1);
}
const privateStatsResponses = spawnSync(process.execPath, [path.join(__dirname, 'verify-private-stats-responses.cjs')], { stdio: 'inherit', timeout: 60000 });
if (privateStatsResponses.error || privateStatsResponses.status !== 0) {
  console.error('Security regression failed: verify-private-stats-responses.cjs');
  process.exit(1);
}
const stripeErrorResponses = spawnSync(process.execPath, [path.join(__dirname, 'verify-stripe-error-responses.cjs')], { stdio: 'inherit', timeout: 60000 });
if (stripeErrorResponses.error || stripeErrorResponses.status !== 0) {
  console.error('Security regression failed: verify-stripe-error-responses.cjs');
  process.exit(1);
}
const shodanLimitGuidance = spawnSync(process.execPath, [path.join(__dirname, 'verify-shodan-limit-guidance.cjs')], { stdio: 'inherit', timeout: 60000 });
if (shodanLimitGuidance.error || shodanLimitGuidance.status !== 0) {
  console.error('Security regression failed: verify-shodan-limit-guidance.cjs');
  process.exit(1);
}
const kintaiEmployeeAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-employee-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiEmployeeAdmission.error || kintaiEmployeeAdmission.status !== 0) {
  console.error('Security regression failed: verify-kintai-employee-admission.cjs');
  process.exit(1);
}
const kintaiDepartmentMutation = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-department-mutation-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiDepartmentMutation.error || kintaiDepartmentMutation.status !== 0) {
  console.error('Security regression failed: verify-kintai-department-mutation-atomic.cjs');
  process.exit(1);
}
const kintaiWorkRuleMutation = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-work-rule-mutation-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiWorkRuleMutation.error || kintaiWorkRuleMutation.status !== 0) {
  console.error('Security regression failed: verify-kintai-work-rule-mutation-atomic.cjs');
  process.exit(1);
}
const staticAssetUrls = spawnSync(process.execPath, [path.join(__dirname, 'verify-static-asset-urls.cjs')], { stdio: 'inherit', timeout: 60000 });
if (staticAssetUrls.error || staticAssetUrls.status !== 0) {
  console.error('Security regression failed: verify-static-asset-urls.cjs');
  process.exit(1);
}
const quoteWriteRecovery = spawnSync(process.execPath, [path.join(__dirname, 'verify-quote-write-recovery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (quoteWriteRecovery.error || quoteWriteRecovery.status !== 0) {
  console.error('Security regression failed: verify-quote-write-recovery.cjs');
  process.exit(1);
}
const sfaNextActionDate = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-next-action-date.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaNextActionDate.error || sfaNextActionDate.status !== 0) {
  console.error('Security regression failed: verify-sfa-next-action-date.cjs');
  process.exit(1);
}
const sfaTaskDate = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-task-date.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaTaskDate.error || sfaTaskDate.status !== 0) {
  console.error('Security regression failed: verify-sfa-task-date.cjs');
  process.exit(1);
}
const hrAiAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-ai-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrAiAdmission.error || hrAiAdmission.status !== 0) {
  console.error('Security regression failed: verify-hr-ai-admission.cjs');
  process.exit(1);
}
const retiredGenericGenerate = spawnSync(process.execPath, [path.join(__dirname, 'verify-retired-generic-generate.cjs')], { stdio: 'inherit', timeout: 60000 });
if (retiredGenericGenerate.error || retiredGenericGenerate.status !== 0) {
  console.error('Security regression failed: verify-retired-generic-generate.cjs');
  process.exit(1);
}
const sfaAiLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-ai-limit.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaAiLimit.error || sfaAiLimit.status !== 0) {
  console.error('Security regression failed: verify-sfa-ai-limit.cjs');
  process.exit(1);
}
const sfaAiRoutes = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-ai-routes.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaAiRoutes.error || sfaAiRoutes.status !== 0) {
  console.error('Security regression failed: verify-sfa-ai-routes.cjs');
  process.exit(1);
}
const sfaUsagePlan = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-usage-plan.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaUsagePlan.error || sfaUsagePlan.status !== 0) {
  console.error('Security regression failed: verify-sfa-usage-plan.cjs');
  process.exit(1);
}
const orgUsageSelection = spawnSync(process.execPath, [path.join(__dirname, 'verify-org-usage-selection.cjs')], { stdio: 'inherit', timeout: 60000 });
if (orgUsageSelection.error || orgUsageSelection.status !== 0) {
  console.error('Security regression failed: verify-org-usage-selection.cjs');
  process.exit(1);
}
const sfaLimits = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-limits.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaLimits.error || sfaLimits.status !== 0) {
  console.error('Security regression failed: verify-sfa-limits.cjs');
  process.exit(1);
}
const sfaAdmissionRoutes = spawnSync(process.execPath, [path.join(__dirname, 'verify-sfa-admission-routes.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sfaAdmissionRoutes.error || sfaAdmissionRoutes.status !== 0) {
  console.error('Security regression failed: verify-sfa-admission-routes.cjs');
  process.exit(1);
}
const hrEmployeeReactivation = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-employee-reactivation.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEmployeeReactivation.error || hrEmployeeReactivation.status !== 0) {
  console.error('Security regression failed: verify-hr-employee-reactivation.cjs');
  process.exit(1);
}
const hrMemberLink = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-member-link.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrMemberLink.error || hrMemberLink.status !== 0) {
  console.error('Security regression failed: verify-hr-member-link.cjs');
  process.exit(1);
}
const hrOwnerTransfer = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-owner-transfer.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrOwnerTransfer.error || hrOwnerTransfer.status !== 0) {
  console.error('Security regression failed: verify-hr-owner-transfer.cjs');
  process.exit(1);
}
const hrMemberMutation = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-member-mutation-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrMemberMutation.error || hrMemberMutation.status !== 0) {
  console.error('Security regression failed: verify-hr-member-mutation-atomic.cjs');
  process.exit(1);
}
const hrEmployeeReads = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-employee-reads.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEmployeeReads.error || hrEmployeeReads.status !== 0) {
  console.error('Security regression failed: verify-hr-employee-reads.cjs');
  process.exit(1);
}
const hrDepartmentAccess = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-department-access.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrDepartmentAccess.error || hrDepartmentAccess.status !== 0) {
  console.error('Security regression failed: verify-hr-department-access.cjs');
  process.exit(1);
}
const hrEmployeeAccess = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-employee-access.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEmployeeAccess.error || hrEmployeeAccess.status !== 0) {
  console.error('Security regression failed: verify-hr-employee-access.cjs');
  process.exit(1);
}
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
const mensetsuEvaluationEvidence = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-evaluation-evidence.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuEvaluationEvidence.error || mensetsuEvaluationEvidence.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-evaluation-evidence.cjs');
  process.exit(1);
}
const serviceUsageNotificationPrivacy = spawnSync(process.execPath, [path.join(__dirname, 'verify-service-usage-notification-privacy.cjs')], { stdio: 'inherit', timeout: 60000 });
if (serviceUsageNotificationPrivacy.error || serviceUsageNotificationPrivacy.status !== 0) {
  console.error('Security regression failed: verify-service-usage-notification-privacy.cjs');
  process.exit(1);
}
const aishodanProductAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-product-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanProductAdmission.error || aishodanProductAdmission.status !== 0) {
  console.error('Security regression failed: verify-aishodan-product-admission.cjs');
  process.exit(1);
}
const aishodanProductDelete = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-product-delete.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanProductDelete.error || aishodanProductDelete.status !== 0) {
  console.error('Security regression failed: verify-aishodan-product-delete.cjs');
  process.exit(1);
}
const aishodanRoomDelete = spawnSync(process.execPath, [path.join(__dirname, 'verify-aishodan-room-delete.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aishodanRoomDelete.error || aishodanRoomDelete.status !== 0) {
  console.error('Security regression failed: verify-aishodan-room-delete.cjs');
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
const organizationQuotaLedger = spawnSync(process.execPath, [path.join(__dirname, 'verify-organization-quota-ledger.cjs')], { stdio: 'inherit', timeout: 60000 });
if (organizationQuotaLedger.error || organizationQuotaLedger.status !== 0) {
  console.error('Security regression failed: verify-organization-quota-ledger.cjs');
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
const teamInviteIntegrity = spawnSync(process.execPath, [path.join(__dirname, 'verify-team-invite-integrity.cjs')], { stdio: 'inherit', timeout: 60000 });
if (teamInviteIntegrity.error || teamInviteIntegrity.status !== 0) {
  console.error('Security regression failed: verify-team-invite-integrity.cjs');
  process.exit(1);
}
const sharedMemberMutation = spawnSync(process.execPath, [path.join(__dirname, 'verify-shared-member-mutation-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (sharedMemberMutation.error || sharedMemberMutation.status !== 0) {
  console.error('Security regression failed: verify-shared-member-mutation-atomic.cjs');
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
const interviewGuestClaim = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-guest-claim.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewGuestClaim.error || interviewGuestClaim.status !== 0) {
  console.error('Security regression failed: verify-interview-guest-claim.cjs');
  process.exit(1);
}
const interviewMaterialDelete = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-material-delete.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewMaterialDelete.error || interviewMaterialDelete.status !== 0) {
  console.error('Security regression failed: verify-interview-material-delete.cjs');
  process.exit(1);
}
const interviewProjectDeleteOwner = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-project-delete-owner.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewProjectDeleteOwner.error || interviewProjectDeleteOwner.status !== 0) {
  console.error('Security regression failed: verify-interview-project-delete-owner.cjs');
  process.exit(1);
}
const interviewUploadConfirm = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-upload-confirm.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewUploadConfirm.error || interviewUploadConfirm.status !== 0) {
  console.error('Security regression failed: verify-interview-upload-confirm.cjs');
  process.exit(1);
}
const interviewUploadLimitActions = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-upload-limit-actions.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewUploadLimitActions.error || interviewUploadLimitActions.status !== 0) {
  console.error('Security regression failed: verify-interview-upload-limit-actions.cjs');
  process.exit(1);
}
const interviewArticleLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-article-limit.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewArticleLimit.error || interviewArticleLimit.status !== 0) {
  console.error('Security regression failed: verify-interview-article-limit.cjs');
  process.exit(1);
}
const interviewReviseInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-revise-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewReviseInput.error || interviewReviseInput.status !== 0) {
  console.error('Security regression failed: verify-interview-revise-input.cjs');
  process.exit(1);
}
const interviewThumbnail = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-thumbnail.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewThumbnail.error || interviewThumbnail.status !== 0) {
  console.error('Security regression failed: verify-interview-thumbnail.cjs');
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
const aioPricingScope = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-pricing-scope.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioPricingScope.error || aioPricingScope.status !== 0) {
  console.error('Security regression failed: verify-aio-pricing-scope.cjs');
  process.exit(1);
}
const aioPlanCta = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-plan-cta.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioPlanCta.error || aioPlanCta.status !== 0) {
  console.error('Security regression failed: verify-aio-plan-cta.cjs');
  process.exit(1);
}
const unifiedPricingOrg = spawnSync(process.execPath, [path.join(__dirname, 'verify-unified-pricing-org.cjs')], { stdio: 'inherit', timeout: 60000 });
if (unifiedPricingOrg.error || unifiedPricingOrg.status !== 0) {
  console.error('Security regression failed: verify-unified-pricing-org.cjs');
  process.exit(1);
}
const seoArticleAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-article-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoArticleAdmission.error || seoArticleAdmission.status !== 0) {
  console.error('Security regression failed: verify-seo-article-admission.cjs');
  process.exit(1);
}
const seoRegenerationAdmission = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-regeneration-admission.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoRegenerationAdmission.error || seoRegenerationAdmission.status !== 0) {
  console.error('Security regression failed: verify-seo-regeneration-admission.cjs');
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
const bannerTemplatePlan = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-template-plan.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTemplatePlan.error || bannerTemplatePlan.status !== 0) {
  console.error('Security regression failed: verify-banner-template-plan.cjs');
  process.exit(1);
}
const bannerTextInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-text-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTextInput.error || bannerTextInput.status !== 0) {
  console.error('Security regression failed: verify-banner-text-input.cjs');
  process.exit(1);
}
const bannerDiagnosticsAuth = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-diagnostics-auth.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerDiagnosticsAuth.error || bannerDiagnosticsAuth.status !== 0) {
  console.error('Security regression failed: verify-banner-diagnostics-auth.cjs');
  process.exit(1);
}
const bannerTemplatePageInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-template-page-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTemplatePageInput.error || bannerTemplatePageInput.status !== 0) {
  console.error('Security regression failed: verify-banner-template-page-input.cjs');
  process.exit(1);
}
const bannerTemplateImageCache = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-template-image-cache.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerTemplateImageCache.error || bannerTemplateImageCache.status !== 0) {
  console.error('Security regression failed: verify-banner-template-image-cache.cjs');
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
const adminUserQuotas = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-user-quotas.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminUserQuotas.error || adminUserQuotas.status !== 0) {
  console.error('Security regression failed: verify-admin-user-quotas.cjs');
  process.exit(1);
}
const seoUsageSummary = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-usage-summary.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoUsageSummary.error || seoUsageSummary.status !== 0) {
  console.error('Security regression failed: verify-seo-usage-summary.cjs');
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
const kintaiInviteIssuance = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-invite-issuance.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiInviteIssuance.error || kintaiInviteIssuance.status !== 0) {
  console.error('Security regression failed: verify-kintai-invite-issuance.cjs');
  process.exit(1);
}
const hrInviteIssuance = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-invite-issuance.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrInviteIssuance.error || hrInviteIssuance.status !== 0) {
  console.error('Security regression failed: verify-hr-invite-issuance.cjs');
  process.exit(1);
}
const promaneInviteDelivery = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-invite-delivery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneInviteDelivery.error || promaneInviteDelivery.status !== 0) {
  console.error('Security regression failed: verify-promane-invite-delivery.cjs');
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
const adminUserExport = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-user-export-csv.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminUserExport.error || adminUserExport.status !== 0) {
  console.error('Security regression failed: verify-admin-user-export-csv.cjs');
  process.exit(1);
}
const doyalistWorksheet = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-worksheet.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistWorksheet.error || doyalistWorksheet.status !== 0) {
  console.error('Security regression failed: verify-doyalist-worksheet.cjs');
  process.exit(1);
}
const kintaiExport = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-export.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiExport.error || kintaiExport.status !== 0) {
  console.error('Security regression failed: verify-kintai-export.cjs');
  process.exit(1);
}
const kintaiAdminHistory = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-admin-history.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiAdminHistory.error || kintaiAdminHistory.status !== 0) {
  console.error('Security regression failed: verify-kintai-admin-history.cjs');
  process.exit(1);
}
const kintaiAdminOvernight = spawnSync(process.execPath, [path.join(__dirname, 'verify-kintai-admin-overnight.cjs')], { stdio: 'inherit', timeout: 60000 });
if (kintaiAdminOvernight.error || kintaiAdminOvernight.status !== 0) {
  console.error('Security regression failed: verify-kintai-admin-overnight.cjs');
  process.exit(1);
}
const doyalistHelperInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-helper-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistHelperInput.error || doyalistHelperInput.status !== 0) {
  console.error('Security regression failed: verify-doyalist-helper-input.cjs');
  process.exit(1);
}
const doyalistUsageSummary = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-usage-summary.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistUsageSummary.error || doyalistUsageSummary.status !== 0) {
  console.error('Security regression failed: verify-doyalist-usage-summary.cjs');
  process.exit(1);
}
const doyalistPreferences = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-preferences.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistPreferences.error || doyalistPreferences.status !== 0) {
  console.error('Security regression failed: verify-doyalist-preferences.cjs');
  process.exit(1);
}
const doyalistStreamJson = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-stream-json.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistStreamJson.error || doyalistStreamJson.status !== 0) {
  console.error('Security regression failed: verify-doyalist-stream-json.cjs');
  process.exit(1);
}
const doyalistProjectInput = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyalist-project-input.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyalistProjectInput.error || doyalistProjectInput.status !== 0) {
  console.error('Security regression failed: verify-doyalist-project-input.cjs');
  process.exit(1);
}
const personaBannerPlan = spawnSync(process.execPath, [path.join(__dirname, 'verify-persona-banner-plan.cjs')], { stdio: 'inherit', timeout: 60000 });
if (personaBannerPlan.error || personaBannerPlan.status !== 0) {
  console.error('Security regression failed: verify-persona-banner-plan.cjs');
  process.exit(1);
}
const hrEmployeePages = spawnSync(process.execPath, [path.join(__dirname, 'verify-hr-employee-pages.cjs')], { stdio: 'inherit', timeout: 60000 });
if (hrEmployeePages.error || hrEmployeePages.status !== 0) {
  console.error('Security regression failed: verify-hr-employee-pages.cjs');
  process.exit(1);
}
const adminKintaiOrgPages = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-kintai-organization-pages.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminKintaiOrgPages.error || adminKintaiOrgPages.status !== 0) {
  console.error('Security regression failed: verify-admin-kintai-organization-pages.cjs');
  process.exit(1);
}
const promaneProjectDeleteAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-project-delete-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneProjectDeleteAtomic.error || promaneProjectDeleteAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-project-delete-atomic.cjs');
  process.exit(1);
}
const promaneRecordDeleteAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-record-delete-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneRecordDeleteAtomic.error || promaneRecordDeleteAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-record-delete-atomic.cjs');
  process.exit(1);
}
const promaneClientWriteAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-client-write-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneClientWriteAtomic.error || promaneClientWriteAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-client-write-atomic.cjs');
  process.exit(1);
}
const promaneRepairAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-repair-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneRepairAtomic.error || promaneRepairAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-repair-atomic.cjs');
  process.exit(1);
}
const promaneWorkspaceSettingsAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-workspace-settings-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneWorkspaceSettingsAtomic.error || promaneWorkspaceSettingsAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-workspace-settings-atomic.cjs');
  process.exit(1);
}
const promaneInvitationDeleteAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-promane-invitation-delete-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (promaneInvitationDeleteAtomic.error || promaneInvitationDeleteAtomic.status !== 0) {
  console.error('Security regression failed: verify-promane-invitation-delete-atomic.cjs');
  process.exit(1);
}
const quoteIssuerSaveAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-quote-issuer-save-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (quoteIssuerSaveAtomic.error || quoteIssuerSaveAtomic.status !== 0) {
  console.error('Security regression failed: verify-quote-issuer-save-atomic.cjs');
  process.exit(1);
}
const mensetsuEndBackground = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-end-background.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuEndBackground.error || mensetsuEndBackground.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-end-background.cjs');
  process.exit(1);
}
const mensetsuEvaluationClaim = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-evaluation-claim.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuEvaluationClaim.error || mensetsuEvaluationClaim.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-evaluation-claim.cjs');
  process.exit(1);
}
const mensetsuEvaluationRecovery = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-evaluation-recovery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuEvaluationRecovery.error || mensetsuEvaluationRecovery.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-evaluation-recovery.cjs');
  process.exit(1);
}
const mensetsuAdvanceAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-advance-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuAdvanceAtomic.error || mensetsuAdvanceAtomic.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-advance-atomic.cjs');
  process.exit(1);
}
const mensetsuConsentAtomic = spawnSync(process.execPath, [path.join(__dirname, 'verify-mensetsu-consent-atomic.cjs')], { stdio: 'inherit', timeout: 60000 });
if (mensetsuConsentAtomic.error || mensetsuConsentAtomic.status !== 0) {
  console.error('Security regression failed: verify-mensetsu-consent-atomic.cjs');
  process.exit(1);
}
for (const file of ['verify-mensetsu-manager-state-atomic.cjs', 'verify-mensetsu-recording-lease.cjs', 'verify-mensetsu-recording-purge-queue.cjs', 'verify-mensetsu-transcript-finalization.cjs', 'verify-mensetsu-turn-idempotency.cjs', 'verify-mensetsu-client-delivery.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) {
    console.error(`Security regression failed: ${file}`);
    process.exit(1);
  }
}
const adminKintaiEmployeePages = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-kintai-employee-pages.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminKintaiEmployeePages.error || adminKintaiEmployeePages.status !== 0) {
  console.error('Security regression failed: verify-admin-kintai-employee-pages.cjs');
  process.exit(1);
}
for (const file of ['verify-quote-ai-input.cjs', 'verify-quote-document-actor.cjs', 'verify-quote-product-admission.cjs', 'verify-mensetsu-token-provider.cjs', 'verify-service-client-deadlines.cjs', 'verify-doyalist-collection-budget.cjs', 'verify-doyalist-provider-json.cjs', 'verify-doyaslide-style-preview.cjs', 'verify-seo-image-purge.cjs', 'verify-seo-durable-storage.cjs', 'verify-seo-image-admission.cjs', 'verify-swipe-test-admission.cjs', 'verify-guide-image-access.cjs', 'verify-seo-tool-admission.cjs', 'verify-seo-error-sanitization.cjs', 'verify-seo-template-admin.cjs', 'verify-promane-feedback-delivery.cjs', 'verify-service-error-sanitization.cjs', 'verify-hr-error-sanitization.cjs', 'verify-doyalist-error-sanitization.cjs', 'verify-adimage-image-budget.cjs', 'verify-hr-usage-error.cjs', 'verify-doyalist-layout-plan.cjs', 'verify-doyalist-pricing-status.cjs', 'verify-kintai-usage-error.cjs', 'verify-service-plan-fallback.cjs', 'verify-doyaslide-load-errors.cjs', 'verify-cunning-load-errors.cjs', 'verify-aishodan-stats-all.cjs', 'verify-promane-invitation-ui.cjs', 'verify-promane-invitation-pages.cjs', 'verify-mensetsu-compare-ui.cjs', 'verify-mensetsu-compare-pages.cjs', 'verify-adimage-concept-pages.cjs', 'verify-doyalist-history-ui.cjs', 'verify-doyalist-approach-pages.cjs', 'verify-cunning-profile-pages.cjs', 'verify-aishodan-list-pages.cjs', 'verify-kintai-request-pagination.cjs', 'verify-kintai-employee-pages.cjs', 'verify-shodan-preparation-pages.cjs', 'verify-shodan-quota-atomic.cjs', 'verify-shodan-owner-plan.cjs', 'verify-shodan-profile-budget.cjs', 'verify-shodan-slide-lease.cjs', 'verify-sfa-lead-update.cjs', 'verify-dependency-floor.cjs', 'verify-auth-adimage.cjs', 'verify-safe-fetch.cjs', 'verify-doyalist-export-all.cjs', 'verify-doyalist-scraper.cjs', 'verify-doyaslide-scrape.cjs', 'verify-seo-reference.cjs', 'verify-safe-browser.cjs', 'verify-banner-safe-url.cjs', 'verify-banner-thumb-access.cjs', 'verify-banner-history-retention.cjs', 'verify-banner-history-pagination.cjs', 'verify-banner-history-access.cjs', 'verify-banner-legacy-history.cjs', 'verify-banner-daily-stats.cjs', 'verify-banner-account-cache.cjs', 'notification-security.cjs', 'verify-data-integrity.cjs', 'verify-billing-integrity.cjs', 'verify-related-records.cjs', 'verify-admin-billing-integrity.cjs', 'verify-prompt-migration-auth.cjs', 'verify-retired-db-sync.cjs', 'verify-retired-slide-api.cjs', 'verify-seo-schema-readiness.cjs', 'verify-owner-boundaries.cjs', 'verify-banner-quota.cjs', 'verify-service-limit-ui.cjs', 'verify-promane-write-access.cjs', 'verify-kintai-employee-atomic.cjs', 'verify-kintai-toggle.cjs', 'verify-kintai-disabled-clock.cjs', 'verify-kintai-disabled-access.cjs', 'verify-kintai-disabled-pages.cjs', 'verify-sfa-elapsed.cjs', 'verify-sfa-activity-order.cjs', 'verify-quote-list-pagination.cjs', 'verify-quote-issuer-load.cjs', 'verify-quote-confirm-response.cjs', 'verify-quote-status-transition.cjs', 'verify-quote-atomic-save.cjs', 'verify-quote-money.cjs', 'verify-quote-pdf-ui.cjs', 'verify-quote-provenance.cjs', 'verify-quote-create-atomic.cjs', 'verify-quote-text-limits.cjs', 'verify-sfa-task-delete.cjs', 'verify-sfa-task-input.cjs', 'verify-sfa-task-update.cjs', 'verify-sfa-create-stage.cjs', 'verify-sfa-convert.cjs', 'verify-hr-finalized.cjs', 'verify-hr-evaluation-read.cjs', 'verify-hr-evaluation-list.cjs', 'verify-hr-evaluation-related-reads.cjs', 'verify-hr-evaluation-ai.cjs', 'verify-hr-evaluation-write.cjs', 'verify-hr-rating-fields.cjs', 'verify-hr-ai-save-first.cjs', 'verify-hr-form-locks.cjs', 'verify-hr-evaluation-create-access.cjs', 'verify-doyalist-collect-preservation.cjs', 'verify-interview-autosave.cjs', 'verify-interview-save-conflict.cjs', 'verify-interview-title-save.cjs', 'verify-sfa-task-pagination.cjs', 'verify-hr-one-on-one-roundtrip.cjs', 'verify-hr-one-on-one-input.cjs', 'verify-hr-one-on-one-summary-flow.cjs', 'verify-hr-one-on-one-access.cjs', 'verify-hr-one-on-one-related.cjs', 'verify-hr-one-on-one-create-private.cjs', 'verify-hr-one-on-one-pagination.cjs', 'verify-hr-one-on-one-list-ui.cjs', 'verify-hr-one-on-one-date.cjs', 'verify-hr-one-on-one-navigation.cjs', 'verify-cancellation-partial.cjs', 'verify-stripe-discovery.cjs', 'verify-trial-failure.cjs', 'verify-subscription-resume.cjs', 'verify-subscription-status.cjs', 'verify-seo-content-owner.cjs', 'verify-seo-memo-outline.cjs', 'verify-seo-export-owner.cjs', 'verify-seo-check-owner.cjs', 'verify-seo-check-persistence.cjs', 'verify-seo-generation-owner.cjs', 'verify-seo-images-owner.cjs', 'verify-seo-batch-results.cjs', 'verify-seo-storage-collision.cjs', 'verify-seo-image-read.cjs', 'verify-seo-storage-boundary.cjs', 'verify-seo-editor-save.cjs', 'verify-seo-editor-navigation.cjs', 'verify-seo-article-access.cjs', 'verify-seo-job-restart.cjs', 'verify-seo-candidates.cjs', 'verify-seo-job-vibe-owner.cjs', 'verify-seo-job-controls.cjs', 'verify-seo-legacy-guest-generation.cjs', 'verify-seo-pipeline-stop.cjs', 'verify-seo-job-ui.cjs', 'verify-seo-job-cancel-ui.cjs', 'verify-seo-job-response.cjs', 'verify-seo-list-read.cjs', 'verify-evaluation-lifecycle.cjs', 'verify-mensetsu-session-pages.cjs', 'verify-mensetsu-turn-order.cjs', 'verify-aishodan-end-once.cjs', 'verify-aishodan-token-state.cjs', 'verify-mensetsu-turn-metadata.cjs', 'verify-shodan-slide-save.cjs', 'verify-shodan-proposal-save.cjs', 'verify-shodan-slide-completeness.cjs', 'verify-shodan-pdf-action.cjs', 'verify-persona-image-owner.cjs', 'verify-persona-plan-cta.cjs', 'verify-aio-plan-cta.cjs', 'verify-adimage-response-owner.cjs', 'verify-doyaslide-revert.cjs', 'verify-promane-time-project.cjs', 'verify-promane-rate-snapshot.cjs', 'verify-promane-timesheet-query.cjs', 'verify-promane-time-input.cjs', 'verify-promane-expense-input.cjs', 'verify-promane-numeric-fields.cjs', 'verify-promane-project-dates.cjs', 'verify-promane-project-text.cjs', 'verify-promane-project-quota.cjs', 'verify-promane-invite-admission.cjs', 'verify-promane-project-update-atomic.cjs', 'verify-promane-task-update-atomic.cjs', 'verify-promane-task-mutations-atomic.cjs', 'verify-promane-project-repair.cjs', 'verify-promane-report-values.cjs', 'verify-kintai-correction-atomic.cjs', 'verify-kintai-request-read.cjs', 'verify-kintai-request-actor-atomic.cjs', 'verify-kintai-request-create-actor.cjs', 'verify-kintai-work-intervals.cjs', 'verify-kintai-clock-atomic.cjs', 'verify-kintai-clock-input.cjs', 'verify-kintai-clock-order.cjs', 'verify-kintai-read-only.cjs', 'verify-kintai-leave-approval.cjs', 'verify-kintai-leave-cancel.cjs', 'verify-aio-member-mutation-atomic.cjs', 'verify-aio-scan-delete-actor.cjs', 'verify-aio-missing-measurements.cjs', 'verify-aio-cron-scheduling.cjs', 'verify-aio-quota.cjs', 'verify-aio-scan-history.cjs', 'verify-cunning-transcribe-gate.cjs', 'verify-cunning-allowance.cjs', 'verify-cunning-cumulative-ui.cjs', 'verify-cunning-final-audio.cjs', 'verify-cunning-final-audio-retry.cjs', 'verify-cunning-report-complete.cjs', 'verify-cunning-report-recovery.cjs', 'verify-cunning-revision.cjs', 'verify-cunning-report-freshness.cjs', 'verify-cunning-history.cjs', 'verify-cunning-history-list.cjs', 'verify-adimage-export.cjs', 'verify-sfa-summary.cjs', 'verify-adimage-quota-reasons.cjs', 'verify-persona-account-storage.cjs', 'verify-persona-restore-images.cjs', 'verify-persona-history-images.cjs', 'verify-persona-history-delete.cjs', 'verify-persona-image-access.cjs', 'verify-persona-scene-retry.cjs', 'verify-persona-safe-url.cjs', 'verify-persona-image-entitlements.cjs', 'verify-persona-image-storage.cjs', 'verify-persona-image-timeouts.cjs', 'verify-persona-banner-size.cjs', 'verify-persona-plan-limits.cjs', 'verify-persona-project-history.cjs', 'verify-persona-live-access.cjs', 'verify-persona-result-schema.cjs', 'verify-persona-display-data.cjs', 'verify-persona-image-purge.cjs', 'verify-cunning-session-input.cjs', 'verify-cunning-session-delete.cjs', 'verify-cunning-usage-interval.cjs', 'verify-cunning-recording-api.cjs', 'verify-cunning-audio-protocol.cjs', 'verify-cunning-final-answer.cjs', 'verify-cunning-legacy-limit-actions.cjs', 'verify-cunning-answer-language.cjs', 'verify-cunning-live-view.cjs', 'verify-cunning-live-history.cjs', 'verify-cunning-recording-client.cjs', 'verify-cunning-audio-window-client.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) {
    console.error(`Security regression failed: ${file}`);
    process.exit(1);
  }
}
const cunningReload = spawnSync(process.execPath, [path.join(__dirname, 'verify-cunning-final-answer-reload.cjs')], { stdio: 'inherit', timeout: 60000 });
if (cunningReload.error || cunningReload.status !== 0) {
  console.error('Security regression failed: verify-cunning-final-answer-reload.cjs');
  process.exit(1);
}
const stripeWebhookReceipts = spawnSync(process.execPath, [path.join(__dirname, 'verify-stripe-webhook-receipts.cjs')], { stdio: 'inherit', timeout: 60000 });
if (stripeWebhookReceipts.error || stripeWebhookReceipts.status !== 0) {
  console.error('Security regression failed: verify-stripe-webhook-receipts.cjs');
  process.exit(1);
}
const stripeWebhookNotifications = spawnSync(process.execPath, [path.join(__dirname, 'verify-stripe-webhook-notifications.cjs')], { stdio: 'inherit', timeout: 60000 });
if (stripeWebhookNotifications.error || stripeWebhookNotifications.status !== 0) {
  console.error('Security regression failed: verify-stripe-webhook-notifications.cjs');
  process.exit(1);
}
const adminStripeOwnership = spawnSync(process.execPath, [path.join(__dirname, 'verify-admin-stripe-ownership.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adminStripeOwnership.error || adminStripeOwnership.status !== 0) {
  console.error('Security regression failed: verify-admin-stripe-ownership.cjs');
  process.exit(1);
}
const billingAuditScope = spawnSync(process.execPath, [path.join(__dirname, 'verify-billing-audit-scope.cjs')], { stdio: 'inherit', timeout: 60000 });
if (billingAuditScope.error || billingAuditScope.status !== 0) {
  console.error('Security regression failed: verify-billing-audit-scope.cjs');
  process.exit(1);
}
const billingAuditRoute = spawnSync(process.execPath, [path.join(__dirname, 'verify-billing-audit-route.cjs')], { stdio: 'inherit', timeout: 60000 });
if (billingAuditRoute.error || billingAuditRoute.status !== 0) {
  console.error('Security regression failed: verify-billing-audit-route.cjs');
  process.exit(1);
}
const billingReportDelivery = spawnSync(process.execPath, [path.join(__dirname, 'verify-billing-report-delivery.cjs')], { stdio: 'inherit', timeout: 60000 });
if (billingReportDelivery.error || billingReportDelivery.status !== 0) {
  console.error('Security regression failed: verify-billing-report-delivery.cjs');
  process.exit(1);
}
const operationsCronRoutes = spawnSync(process.execPath, [path.join(__dirname, 'verify-operations-cron-routes.cjs')], { stdio: 'inherit', timeout: 60000 });
if (operationsCronRoutes.error || operationsCronRoutes.status !== 0) {
  console.error('Security regression failed: verify-operations-cron-routes.cjs');
  process.exit(1);
}
const feedbackAlertBoundary = spawnSync(process.execPath, [path.join(__dirname, 'verify-feedback-alert-boundary.cjs')], { stdio: 'inherit', timeout: 60000 });
if (feedbackAlertBoundary.error || feedbackAlertBoundary.status !== 0) {
  console.error('Security regression failed: verify-feedback-alert-boundary.cjs');
  process.exit(1);
}
const serviceOperationsRolling = spawnSync(process.execPath, [path.join(__dirname, 'verify-service-operations-rolling.cjs')], { stdio: 'inherit', timeout: 60000 });
if (serviceOperationsRolling.error || serviceOperationsRolling.status !== 0) {
  console.error('Security regression failed: verify-service-operations-rolling.cjs');
  process.exit(1);
}
const cunningCompanyAnalysis = spawnSync(process.execPath, [path.join(__dirname, 'verify-cunning-company-analysis.cjs')], { stdio: 'inherit', timeout: 60000 });
if (cunningCompanyAnalysis.error || cunningCompanyAnalysis.status !== 0) {
  console.error('Security regression failed: verify-cunning-company-analysis.cjs');
  process.exit(1);
}
const cunningKnowledgeIngest = spawnSync(process.execPath, [path.join(__dirname, 'verify-cunning-knowledge-ingest.cjs')], { stdio: 'inherit', timeout: 60000 });
if (cunningKnowledgeIngest.error || cunningKnowledgeIngest.status !== 0) {
  console.error('Security regression failed: verify-cunning-knowledge-ingest.cjs');
  process.exit(1);
}
const cunningScrapeSize = spawnSync(process.execPath, [path.join(__dirname, 'verify-cunning-scrape-size.cjs')], { stdio: 'inherit', timeout: 60000 });
if (cunningScrapeSize.error || cunningScrapeSize.status !== 0) {
  console.error('Security regression failed: verify-cunning-scrape-size.cjs');
  process.exit(1);
}
const seoExtractFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-seo-extract-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (seoExtractFetch.error || seoExtractFetch.status !== 0) {
  console.error('Security regression failed: verify-seo-extract-fetch.cjs');
  process.exit(1);
}
const adimageRefPaletteFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-adimage-ref-palette-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adimageRefPaletteFetch.error || adimageRefPaletteFetch.status !== 0) {
  console.error('Security regression failed: verify-adimage-ref-palette-fetch.cjs');
  process.exit(1);
}
const doyaslideStorageFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-doyaslide-storage-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (doyaslideStorageFetch.error || doyaslideStorageFetch.status !== 0) {
  console.error('Security regression failed: verify-doyaslide-storage-fetch.cjs');
  process.exit(1);
}
const shodanSlideFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-shodan-slide-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (shodanSlideFetch.error || shodanSlideFetch.status !== 0) {
  console.error('Security regression failed: verify-shodan-slide-fetch.cjs');
  process.exit(1);
}
const bodyCheckFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-body-check-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bodyCheckFetch.error || bodyCheckFetch.status !== 0) {
  console.error('Security regression failed: verify-body-check-fetch.cjs');
  process.exit(1);
}
const aioBrandFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-brand-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioBrandFetch.error || aioBrandFetch.status !== 0) {
  console.error('Security regression failed: verify-aio-brand-fetch.cjs');
  process.exit(1);
}
const nanobannerFileFetch = spawnSync(process.execPath, [path.join(__dirname, 'verify-nanobanner-file-fetch.cjs')], { stdio: 'inherit', timeout: 60000 });
if (nanobannerFileFetch.error || nanobannerFileFetch.status !== 0) {
  console.error('Security regression failed: verify-nanobanner-file-fetch.cjs');
  process.exit(1);
}
const imageGeneratorResponse = spawnSync(process.execPath, [path.join(__dirname, 'verify-image-generator-response.cjs')], { stdio: 'inherit', timeout: 60000 });
if (imageGeneratorResponse.error || imageGeneratorResponse.status !== 0) {
  console.error('Security regression failed: verify-image-generator-response.cjs');
  process.exit(1);
}
const openaiImageResponse = spawnSync(process.execPath, [path.join(__dirname, 'verify-openai-image-response.cjs')], { stdio: 'inherit', timeout: 60000 });
if (openaiImageResponse.error || openaiImageResponse.status !== 0) {
  console.error('Security regression failed: verify-openai-image-response.cjs');
  process.exit(1);
}
const aioEngineResponses = spawnSync(process.execPath, [path.join(__dirname, 'verify-aio-engine-responses.cjs')], { stdio: 'inherit', timeout: 60000 });
if (aioEngineResponses.error || aioEngineResponses.status !== 0) {
  console.error('Security regression failed: verify-aio-engine-responses.cjs');
  process.exit(1);
}
const adimageVisionResponse = spawnSync(process.execPath, [path.join(__dirname, 'verify-adimage-vision-response.cjs')], { stdio: 'inherit', timeout: 60000 });
if (adimageVisionResponse.error || adimageVisionResponse.status !== 0) {
  console.error('Security regression failed: verify-adimage-vision-response.cjs');
  process.exit(1);
}
const bannerVisionResponse = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-vision-response.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerVisionResponse.error || bannerVisionResponse.status !== 0) {
  console.error('Security regression failed: verify-banner-vision-response.cjs');
  process.exit(1);
}
const personaGenerateBounds = spawnSync(process.execPath, [path.join(__dirname, 'verify-persona-generate-bounds.cjs')], { stdio: 'inherit', timeout: 60000 });
if (personaGenerateBounds.error || personaGenerateBounds.status !== 0) {
  console.error('Security regression failed: verify-persona-generate-bounds.cjs');
  process.exit(1);
}
const interviewStreamProvider = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-transcribe-stream-provider.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewStreamProvider.error || interviewStreamProvider.status !== 0) {
  console.error('Security regression failed: verify-interview-transcribe-stream-provider.cjs');
  process.exit(1);
}
const bannerProModels = spawnSync(process.execPath, [path.join(__dirname, 'verify-banner-pro-models.cjs')], { stdio: 'inherit', timeout: 60000 });
if (bannerProModels.error || bannerProModels.status !== 0) {
  console.error('Security regression failed: verify-banner-pro-models.cjs');
  process.exit(1);
}
