"use strict";
var BannerClient = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/banner/refine-client.ts
  var refine_client_exports = {};
  __export(refine_client_exports, {
    clearBannerRefineIntent: () => clearBannerRefineIntent,
    createBannerRefineIntent: () => createBannerRefineIntent,
    readBannerRefineIntent: () => readBannerRefineIntent,
    readBannerRefineResponse: () => readBannerRefineResponse
  });
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var storageKey = (actor) => "banner-refine-intent:v1:" + encodeURIComponent(actor);
  var guidance = "\u4FEE\u6B63\u7D50\u679C\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u518D\u751F\u6210\u305B\u305A\u300C\u4FEE\u6B63\u7D50\u679C\u3092\u78BA\u8A8D\u300D\u3092\u62BC\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
  function readBannerRefineIntent(actor) {
    if (!actor) return null;
    const raw = localStorage.getItem(storageKey(actor));
    if (raw === null) return null;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("\u4FDD\u5B58\u3055\u308C\u305F\u64CD\u4F5C\u60C5\u5831\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u304A\u554F\u3044\u5408\u308F\u305B\u304F\u3060\u3055\u3044\u3002");
    }
    if (!value || value.version !== 1 || !UUID.test(value.operationId) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || Object.keys(value).some((key) => !["version", "operationId", "createdAt"].includes(key))) throw new Error("\u4FDD\u5B58\u3055\u308C\u305F\u64CD\u4F5C\u60C5\u5831\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u304A\u554F\u3044\u5408\u308F\u305B\u304F\u3060\u3055\u3044\u3002");
    return value;
  }
  function createBannerRefineIntent(actor) {
    if (!actor) throw new Error("\u30ED\u30B0\u30A4\u30F3\u304C\u5FC5\u8981\u3067\u3059\u3002");
    if (readBannerRefineIntent(actor)) throw new Error("\u524D\u306E\u4FEE\u6B63\u7D50\u679C\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u3001\u65B0\u3057\u3044\u4FEE\u6B63\u3092\u59CB\u3081\u3066\u304F\u3060\u3055\u3044\u3002");
    const value = { version: 1, operationId: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    localStorage.setItem(storageKey(actor), JSON.stringify(value));
    if (readBannerRefineIntent(actor)?.operationId !== value.operationId) throw new Error("\u64CD\u4F5C\u60C5\u5831\u3092\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3002\u65B0\u3057\u3044\u4FEE\u6B63\u306F\u958B\u59CB\u3057\u3066\u3044\u307E\u305B\u3093\u3002");
    return value;
  }
  function clearBannerRefineIntent(actor, operationId) {
    if (readBannerRefineIntent(actor)?.operationId === operationId) localStorage.removeItem(storageKey(actor));
  }
  async function readBannerRefineResponse(response, operationId, signal) {
    const maximum = 33 * 1024 * 1024;
    let reader;
    let timer;
    let abort;
    try {
      const stopped = new Promise((_, reject) => {
        abort = () => reject(new Error(guidance));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
        timer = setTimeout(abort, 3e4);
      });
      const reading = (async () => {
        if (Number(response.headers.get("content-length")) > maximum || !response.body) throw new Error(guidance);
        reader = response.body.getReader();
        const chunks = [];
        let length = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          length += next.value.byteLength;
          if (length > maximum) throw new Error(guidance);
          chunks.push(next.value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(guidance);
        if (response.status === 429 && data.code === "MONTHLY_LIMIT_REACHED") {
          const usage = data.usage;
          if (!usage || ![usage.monthlyUsed, usage.monthlyLimit, usage.monthlyRemaining].every(Number.isSafeInteger) || usage.monthlyLimit < 0 || usage.monthlyUsed < 0 || usage.monthlyRemaining !== Math.max(0, usage.monthlyLimit - usage.monthlyUsed)) throw new Error(guidance);
          return { ...data, state: "limit" };
        }
        if (data.operationId !== operationId) throw new Error(guidance);
        if (!["completed", "pending", "missing", "failed", "cancelled", "unavailable"].includes(data.state)) throw new Error(guidance);
        if (data.state === "completed") {
          if (!response.ok || data.success !== true || typeof data.generationId !== "string" || !/^banner-refine-[a-f0-9]{64}$/.test(data.generationId) || typeof data.refinedImage !== "string" || data.refinedImage.length > 32 * 1024 * 1024 || (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.refinedImage) || data.refinedImage.split(",")[1].length % 4 !== 0)) throw new Error(guidance);
          await decodeImage(data.refinedImage, signal);
        } else if (data.success === true || (data.state === "unavailable" ? response.status !== 410 : ![200, 202, 409, 503].includes(response.status))) throw new Error(guidance);
        return data;
      })();
      return await Promise.race([reading, stopped]);
    } catch {
      throw new Error(guidance);
    } finally {
      if (timer) clearTimeout(timer);
      if (abort) signal.removeEventListener("abort", abort);
      void reader?.cancel().catch(() => {
      });
    }
  }
  async function decodeImage(source, signal) {
    await new Promise((resolve, reject) => {
      const image = new Image();
      let timer;
      const clean = () => {
        if (timer) clearTimeout(timer);
        signal.removeEventListener("abort", failed);
        image.onload = null;
        image.onerror = null;
        image.src = "";
      };
      const failed = () => {
        clean();
        reject(new Error(guidance));
      };
      image.onload = () => {
        const valid = image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth <= 8192 && image.naturalHeight <= 8192 && image.naturalWidth * image.naturalHeight <= 16 * 1024 * 1024;
        clean();
        if (valid) resolve();
        else reject(new Error(guidance));
      };
      image.onerror = failed;
      signal.addEventListener("abort", failed, { once: true });
      timer = setTimeout(failed, 15e3);
      if (signal.aborted) failed();
      else image.src = source;
    });
  }
  return __toCommonJS(refine_client_exports);
})();
