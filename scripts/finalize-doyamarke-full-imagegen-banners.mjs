import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const projectRoot = "/Users/mitsumori_katsuki/Code/09_Cursol";
const outputRoot = path.join(
  projectRoot,
  "reference/generated-assets/2026-08-24-doyamarke-service-banners-full-imagegen",
);
const rawDir = path.join(outputRoot, "images");
const finalDir = path.join(outputRoot, "final-1600x900");
const specsDir = path.join(outputRoot, "specs");
const qaDir = path.join(outputRoot, "qa");
const finalFeedbackPath = path.join(qaDir, "feedback-audit-v2-final.json");
const finalLogoAuditPath = path.join(qaDir, "logo-audit-v3-final.json");
const contentCorrectionAuditPath = path.join(qaDir, "content-correction-audit-v4-final.json");

const services = [
  ["seo", "ドヤ記事作成"],
  ["doyalist", "ドヤリスト"],
  ["hr", "ドヤHR"],
  ["kintai", "ドヤ勤怠"],
  ["promane", "ドヤプロマネ"],
  ["doyaslide", "ドヤスライド"],
  ["cunning", "ドヤカンニング"],
  ["sfa", "ドヤ営業管理"],
  ["shodan", "ドヤ商談準備"],
  ["aio", "ドヤAIO"],
  ["adimage", "ドヤ広告画像AI"],
  ["interview", "ドヤインタビュー"],
  ["persona", "ドヤペルソナAI"],
  ["mensetsu", "ドヤ面接官"],
  ["quote", "ドヤ見積もりAI"],
];

const selectedRawFile = {
  seo: "seo-v2-content.png",
  cunning: "cunning-v3.png",
  aio: "aio-v3.png",
  promane: "promane-v2-logo.png",
  doyaslide: "doyaslide-v3-content.png",
  interview: "interview-v2-logo.png",
  persona: "persona-v3-logo.png",
  mensetsu: "mensetsu-v2-content.png",
  quote: "quote-v2-content.png",
};

await fs.mkdir(finalDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });

const checks = [];
const manifestItems = [];
const promptSections = [];

for (const [id, name] of services) {
  const rawFile = selectedRawFile[id] ?? `${id}.png`;
  const rawPath = path.join(rawDir, rawFile);
  const finalPath = path.join(finalDir, `${id}.png`);
  const specPath = path.join(specsDir, `${id}.json`);
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  const rawMeta = await sharp(rawPath).metadata();

  await sharp(rawPath)
    .resize(1600, 900, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(finalPath);

  const finalMeta = await sharp(finalPath).metadata();
  const finalBytes = await fs.readFile(finalPath);
  const sha256 = crypto.createHash("sha256").update(finalBytes).digest("hex");

  checks.push(
    { id, check: "raw_png_decodes", pass: rawMeta.format === "png" },
    { id, check: "raw_is_landscape_16_9", pass: Math.abs(rawMeta.width / rawMeta.height - 16 / 9) < 0.001 },
    { id, check: "final_png_decodes", pass: finalMeta.format === "png" },
    { id, check: "final_dimensions_1600x900", pass: finalMeta.width === 1600 && finalMeta.height === 900 },
    { id, check: "json_spec_exists", pass: Boolean(spec.service?.name && spec.banner?.headline) },
    { id, check: "official_references_exist", pass: Boolean(spec.research?.official_logo_reference && spec.research?.official_screenshot_reference) },
  );

  manifestItems.push({
    id,
    name,
    official_url: spec.service.official_url,
    raw_generated_image: `images/${rawFile}`,
    final_image: `final-1600x900/${id}.png`,
    json_spec: `specs/${id}.json`,
    raw_dimensions: `${rawMeta.width}x${rawMeta.height}`,
    final_dimensions: `${finalMeta.width}x${finalMeta.height}`,
    sha256,
    built_in_codex_full_image_generation: true,
    post_generation_text_overlay: false,
  });

  promptSections.push(
    `## ${name} (${id})\n\n` +
      `- Exact headline: ${spec.banner.headline.join(" / ")}\n` +
      `- Exact support copy: ${spec.banner.support_copy.join(" / ")}\n` +
      `- Exact feature chips: ${spec.banner.feature_chips.join(" / ")}\n` +
      `- Exact CTA: ${spec.banner.cta}\n` +
      `- Layout: ${spec.layout.composition}\n` +
      `- Mascot pose: ${spec.mascot.pose}\n` +
      `- References: ${spec.research.official_logo_reference}, ${spec.research.official_screenshot_reference}, public/character/present.png\n`,
  );
}

const thumbWidth = 320;
const thumbHeight = 180;
const labelHeight = 28;
const columns = 5;
const rows = 3;
const sheetWidth = thumbWidth * columns;
const sheetHeight = (thumbHeight + labelHeight) * rows;
const composites = [];

for (let index = 0; index < services.length; index += 1) {
  const [id, name] = services[index];
  const x = (index % columns) * thumbWidth;
  const y = Math.floor(index / columns) * (thumbHeight + labelHeight);
  const thumb = await sharp(path.join(finalDir, `${id}.png`))
    .resize(thumbWidth, thumbHeight, { fit: "fill" })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0f172a"/><text x="12" y="20" fill="#ffffff" font-size="15" font-weight="700" font-family="Hiragino Sans, Noto Sans JP, sans-serif">${index + 1}. ${name}</text></svg>`,
  );
  composites.push({ input: thumb, left: x, top: y });
  composites.push({ input: label, left: x, top: y + thumbHeight });
}

await sharp({
  create: {
    width: sheetWidth,
    height: sheetHeight,
    channels: 3,
    background: "#e2e8f0",
  },
})
  .composite(composites)
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toFile(path.join(qaDir, "contact-sheet.jpg"));

const finalFeedback = JSON.parse(await fs.readFile(finalFeedbackPath, "utf8"));
for (const item of finalFeedback.final_decisions) {
  const expectedRaw = `images/${selectedRawFile[item.id] ?? `${item.id}.png`}`;
  checks.push(
    {
      id: item.id,
      check: "final_visual_feedback_approved",
      pass: item.decision.startsWith("APPROVED"),
    },
    {
      id: item.id,
      check: "selected_raw_matches_feedback",
      pass: item.selected_raw === expectedRaw,
    },
  );
}

const finalLogoAudit = JSON.parse(await fs.readFile(finalLogoAuditPath, "utf8"));
for (const item of finalLogoAudit.final_items) {
  const expectedRaw = `images/${selectedRawFile[item.id] ?? `${item.id}.png`}`;
  checks.push(
    {
      id: item.id,
      check: "final_official_logo_visual_audit_passed",
      pass: item.decision.startsWith("PASS"),
    },
    {
      id: item.id,
      check: "logo_audit_selected_raw_matches_manifest",
      pass: item.selected_raw === expectedRaw,
    },
  );
}

const contentCorrectionAudit = JSON.parse(await fs.readFile(contentCorrectionAuditPath, "utf8"));
for (const item of contentCorrectionAudit.final_items) {
  const expectedRaw = `images/${selectedRawFile[item.id] ?? `${item.id}.png`}`;
  checks.push(
    {
      id: item.id,
      check: "requested_content_correction_passed",
      pass: item.decision === "PASS",
    },
    {
      id: item.id,
      check: "content_correction_selected_raw_matches_manifest",
      pass: item.selected_raw === expectedRaw,
    },
  );
}

const failures = checks.filter((item) => !item.pass);
const verification = {
  created_at: new Date().toISOString(),
  scope: "15 full-banner images created with built-in Codex image generation",
  count: services.length,
  check_count: checks.length,
  failure_count: failures.length,
  status: failures.length === 0 ? "PASS" : "FAIL",
  visual_feedback: "qa/feedback-audit-v2-final.json",
  official_logo_audit: "qa/logo-audit-v3-final.json",
  user_content_corrections: "qa/content-correction-audit-v4-final.json",
  checks,
};

await fs.writeFile(
  path.join(qaDir, "verification.json"),
  `${JSON.stringify(verification, null, 2)}\n`,
);

await fs.writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(
    {
      created_at: new Date().toISOString(),
      count: services.length,
      mode: "built-in Codex full-image generation for every complete banner, including Japanese text, UI, mascot, logo treatment, background, chips, and CTA",
      post_generation_text_overlay: false,
      final_size: "1600x900",
      items: manifestItems,
    },
    null,
    2,
  )}\n`,
);

await fs.writeFile(
  path.join(outputRoot, "prompts.md"),
  `# Built-in Codex full-image generation prompt set\n\nEvery service was generated with one built-in image-generation call using its official logo, official public UI screenshot, and official mascot as references. Exact Japanese copy came from the corresponding JSON spec. All copy was requested as in-image typography; no post-generation text overlay was used.\n\n${promptSections.join("\n")}`,
);

await fs.writeFile(
  path.join(qaDir, "file-manifest.csv"),
  [
    "id,name,final_image,width,height,sha256",
    ...manifestItems.map((item) =>
      [
        item.id,
        `"${item.name}"`,
        item.final_image,
        1600,
        900,
        item.sha256,
      ].join(","),
    ),
  ].join("\n") + "\n",
);

console.log(JSON.stringify({ status: verification.status, images: services.length, checks: checks.length, failures: failures.length }, null, 2));
