const { spawnSync } = require('node:child_process');
const path = require('node:path');
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
const interviewArticleLimit = spawnSync(process.execPath, [path.join(__dirname, 'verify-interview-article-limit.cjs')], { stdio: 'inherit', timeout: 60000 });
if (interviewArticleLimit.error || interviewArticleLimit.status !== 0) {
  console.error('Security regression failed: verify-interview-article-limit.cjs');
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
for (const file of ['verify-dependency-floor.cjs', 'verify-auth-adimage.cjs', 'verify-safe-fetch.cjs', 'verify-doyalist-export-all.cjs', 'verify-doyalist-scraper.cjs', 'verify-doyaslide-scrape.cjs', 'verify-seo-reference.cjs', 'verify-safe-browser.cjs', 'verify-banner-safe-url.cjs', 'verify-banner-thumb-access.cjs', 'notification-security.cjs', 'verify-data-integrity.cjs', 'verify-billing-integrity.cjs', 'verify-related-records.cjs', 'verify-admin-billing-integrity.cjs', 'verify-prompt-migration-auth.cjs', 'verify-retired-db-sync.cjs', 'verify-seo-schema-readiness.cjs', 'verify-owner-boundaries.cjs', 'verify-banner-quota.cjs', 'verify-service-limit-ui.cjs', 'verify-promane-write-access.cjs', 'verify-kintai-employee-atomic.cjs', 'verify-kintai-toggle.cjs', 'verify-kintai-disabled-clock.cjs', 'verify-sfa-elapsed.cjs', 'verify-sfa-activity-order.cjs', 'verify-quote-issuer-load.cjs', 'verify-quote-confirm-response.cjs', 'verify-quote-status-transition.cjs', 'verify-quote-atomic-save.cjs', 'verify-quote-money.cjs', 'verify-quote-pdf-ui.cjs', 'verify-quote-provenance.cjs', 'verify-quote-create-atomic.cjs', 'verify-quote-text-limits.cjs', 'verify-sfa-task-delete.cjs', 'verify-sfa-task-input.cjs', 'verify-sfa-task-update.cjs', 'verify-sfa-create-stage.cjs', 'verify-sfa-convert.cjs', 'verify-hr-finalized.cjs', 'verify-hr-evaluation-read.cjs', 'verify-hr-evaluation-list.cjs', 'verify-hr-evaluation-related-reads.cjs', 'verify-hr-evaluation-ai.cjs', 'verify-hr-evaluation-write.cjs', 'verify-hr-rating-fields.cjs', 'verify-hr-ai-save-first.cjs', 'verify-hr-form-locks.cjs', 'verify-hr-evaluation-create-access.cjs', 'verify-doyalist-collect-preservation.cjs', 'verify-interview-autosave.cjs', 'verify-interview-save-conflict.cjs', 'verify-interview-title-save.cjs', 'verify-sfa-task-pagination.cjs', 'verify-hr-one-on-one-roundtrip.cjs', 'verify-hr-one-on-one-input.cjs', 'verify-hr-one-on-one-summary-flow.cjs', 'verify-hr-one-on-one-access.cjs', 'verify-hr-one-on-one-related.cjs', 'verify-hr-one-on-one-create-private.cjs', 'verify-hr-one-on-one-pagination.cjs', 'verify-hr-one-on-one-list-ui.cjs', 'verify-hr-one-on-one-date.cjs', 'verify-hr-one-on-one-navigation.cjs', 'verify-cancellation-partial.cjs', 'verify-stripe-discovery.cjs', 'verify-trial-failure.cjs', 'verify-subscription-resume.cjs', 'verify-subscription-status.cjs', 'verify-seo-content-owner.cjs', 'verify-seo-memo-outline.cjs', 'verify-seo-export-owner.cjs', 'verify-seo-check-owner.cjs', 'verify-seo-check-persistence.cjs', 'verify-seo-generation-owner.cjs', 'verify-seo-images-owner.cjs', 'verify-seo-batch-results.cjs', 'verify-seo-storage-collision.cjs', 'verify-seo-image-read.cjs', 'verify-seo-storage-boundary.cjs', 'verify-seo-editor-save.cjs', 'verify-seo-editor-navigation.cjs', 'verify-seo-article-access.cjs', 'verify-seo-job-restart.cjs', 'verify-seo-candidates.cjs', 'verify-seo-job-vibe-owner.cjs', 'verify-seo-job-controls.cjs', 'verify-seo-pipeline-stop.cjs', 'verify-seo-job-ui.cjs', 'verify-seo-job-cancel-ui.cjs', 'verify-seo-job-response.cjs', 'verify-seo-list-read.cjs', 'verify-evaluation-lifecycle.cjs', 'verify-mensetsu-turn-order.cjs', 'verify-aishodan-end-once.cjs', 'verify-aishodan-token-state.cjs', 'verify-mensetsu-turn-metadata.cjs', 'verify-shodan-slide-save.cjs', 'verify-shodan-proposal-save.cjs', 'verify-shodan-slide-completeness.cjs', 'verify-shodan-pdf-action.cjs', 'verify-persona-image-owner.cjs', 'verify-persona-plan-cta.cjs', 'verify-aio-plan-cta.cjs', 'verify-adimage-response-owner.cjs', 'verify-doyaslide-revert.cjs', 'verify-promane-time-project.cjs', 'verify-promane-timesheet-query.cjs', 'verify-promane-time-input.cjs', 'verify-promane-expense-input.cjs', 'verify-promane-numeric-fields.cjs', 'verify-promane-project-dates.cjs', 'verify-promane-project-text.cjs', 'verify-promane-project-quota.cjs', 'verify-promane-project-update-atomic.cjs', 'verify-promane-project-repair.cjs', 'verify-promane-report-values.cjs', 'verify-kintai-correction-atomic.cjs', 'verify-kintai-request-read.cjs', 'verify-kintai-work-intervals.cjs', 'verify-kintai-clock-atomic.cjs', 'verify-kintai-clock-order.cjs', 'verify-kintai-read-only.cjs', 'verify-kintai-leave-approval.cjs', 'verify-kintai-leave-cancel.cjs', 'verify-aio-missing-measurements.cjs', 'verify-aio-quota.cjs', 'verify-cunning-transcribe-gate.cjs', 'verify-cunning-allowance.cjs', 'verify-cunning-cumulative-ui.cjs', 'verify-cunning-final-audio.cjs', 'verify-cunning-final-audio-retry.cjs', 'verify-cunning-report-complete.cjs', 'verify-cunning-revision.cjs', 'verify-cunning-report-freshness.cjs', 'verify-cunning-history.cjs', 'verify-cunning-history-list.cjs', 'verify-adimage-export.cjs', 'verify-sfa-summary.cjs', 'verify-adimage-quota-reasons.cjs', 'verify-persona-account-storage.cjs', 'verify-persona-restore-images.cjs', 'verify-persona-history-images.cjs', 'verify-persona-history-delete.cjs', 'verify-persona-image-access.cjs', 'verify-persona-scene-retry.cjs', 'verify-persona-safe-url.cjs', 'verify-persona-image-entitlements.cjs', 'verify-persona-image-storage.cjs', 'verify-persona-image-timeouts.cjs', 'verify-persona-banner-size.cjs', 'verify-persona-plan-limits.cjs', 'verify-persona-project-history.cjs', 'verify-persona-live-access.cjs', 'verify-persona-result-schema.cjs', 'verify-persona-display-data.cjs', 'verify-persona-image-purge.cjs', 'verify-cunning-session-input.cjs', 'verify-cunning-usage-interval.cjs', 'verify-cunning-recording-api.cjs', 'verify-cunning-audio-protocol.cjs', 'verify-cunning-final-answer.cjs', 'verify-cunning-answer-language.cjs', 'verify-cunning-recording-client.cjs', 'verify-cunning-audio-window-client.cjs']) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit', timeout: 60000 });
  if (result.error || result.status !== 0) {
    console.error(`Security regression failed: ${file}`);
    process.exit(1);
  }
}
