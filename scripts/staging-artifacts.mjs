#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { buildShipmentPrintDocument } from "../lib/admin/shipment-print.ts";
import {
  appendProtectionQuery,
  buildProtectionHeaders,
  buildUrl,
  createProtectedFetchSession,
  formatRequestFailure,
  normalizeBaseUrl,
  parseCliArgs,
  parseSmokeSummary,
  readEnv,
  resolveSmokeSummaryPath,
  sameBaseUrl,
} from "./lib/staging-support.mjs";

const protectedFetch = createProtectedFetchSession();

async function requestJson(baseUrl, routePath, options = {}) {
  const response = await protectedFetch.fetch(buildUrl(baseUrl, routePath), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      formatRequestFailure(
        baseUrl,
        routePath,
        options.method ?? "GET",
        response.status,
        payload,
      ),
    );
  }

  return payload;
}

async function generateAdminAccessToken(baseUrl) {
  const adminEmail = readEnv("ADMIN_EMAILS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];
  if (!adminEmail) {
    throw new Error("ADMIN_EMAILS does not contain an email");
  }

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const anon = createClient(supabaseUrl, anonKey);

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
    options: { redirectTo: baseUrl },
  });
  if (generated.error) {
    throw generated.error;
  }

  const otp = generated.data?.properties?.email_otp;
  if (!otp) {
    throw new Error("Supabase did not return email_otp");
  }

  const verified = await anon.auth.verifyOtp({
    email: adminEmail,
    token: otp,
    type: "magiclink",
  });
  if (verified.error) {
    throw verified.error;
  }

  const accessToken = verified.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("Missing access token after verifyOtp");
  }

  return { accessToken };
}

async function writeApiArtifact(baseUrl, accessToken, routePath, outputPath) {
  const response = await protectedFetch.fetch(buildUrl(baseUrl, routePath), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      formatRequestFailure(baseUrl, routePath, "GET", response.status, text),
    );
  }

  fs.writeFileSync(outputPath, text);
}

async function writeCsvArtifact(baseUrl, accessToken, roundId, outputPath) {
  const csvPath = `/api/export-csv?roundId=${encodeURIComponent(roundId)}`;
  const head = await protectedFetch.fetch(buildUrl(baseUrl, csvPath), {
    method: "HEAD",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!head.ok) {
    throw new Error(
      formatRequestFailure(
        baseUrl,
        csvPath,
        "HEAD",
        head.status,
        await head.text(),
      ),
    );
  }

  const response = await protectedFetch.fetch(buildUrl(baseUrl, csvPath), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      formatRequestFailure(
        baseUrl,
        csvPath,
        "GET",
        response.status,
        await response.text(),
      ),
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

async function writePrintArtifact(baseUrl, accessToken, roundId, orderId, outputDir) {
  const response = await protectedFetch.fetch(
    buildUrl(baseUrl, "/api/orders/print-batch"),
    {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roundId,
      orderIds: [orderId],
    }),
    },
  );
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    throw new Error(
      formatRequestFailure(
        baseUrl,
        "/api/orders/print-batch",
        "POST",
        response.status,
        payload,
      ),
    );
  }

  const html = buildShipmentPrintDocument(payload.orders);
  fs.writeFileSync(path.join(outputDir, "shipment-print-popup.html"), html);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({
      path: path.join(outputDir, "shipment-print-popup.png"),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

async function createPrintArtifactSetup(baseUrl, accessToken, runId) {
  const phone = process.env.STAGING_SMOKE_PHONE?.trim() || "0912-000-678";
  const email =
    process.env.STAGING_SMOKE_EMAIL?.trim() || "smoke@example.com";
  const address =
    process.env.STAGING_SMOKE_ADDRESS?.trim() ||
    "台北市信義區煙霧測試路 1 號";
  const purchaserName =
    process.env.STAGING_SMOKE_PURCHASER_NAME?.trim() || "煙霧測試";
  const phoneLast3 = phone.replace(/\D/g, "").slice(-3);

  const supplierResponse = await requestJson(baseUrl, "/api/suppliers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: `Print Supplier ${runId}`,
      contact_name: "Artifact Runner",
      phone,
      email,
      note: "Created by scripts/staging-artifacts.mjs",
    }),
  });

  const roundResponse = await requestJson(baseUrl, "/api/rounds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: `Print Round ${runId}`,
      deadline: null,
      shipping_fee: 60,
      pickup_option_a: "測試面交 A",
      pickup_option_b: "測試面交 B",
    }),
  });

  const productResponse = await requestJson(baseUrl, "/api/products", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: `Print Product ${runId}`,
      price: 120,
      unit: "袋",
      round_id: roundResponse.round.id,
      supplier_id: supplierResponse.supplier.id,
      stock: 10,
      goal_qty: 1,
      image_url: null,
    }),
  });

  const orderResponse = await requestJson(baseUrl, "/api/submit-order", {
    method: "POST",
    body: JSON.stringify({
      round_id: roundResponse.round.id,
      nickname: `print-${runId}`,
      purchaser_name: purchaserName,
      recipient_name: purchaserName,
      phone,
      address,
      email,
      pickup_location: "測試面交 A",
      items: [
        {
          product_id: productResponse.product.id,
          quantity: 1,
        },
      ],
      submission_key: randomUUID(),
      note: "Print artifact order",
      save_profile: false,
    }),
  });

  await requestJson(baseUrl, "/api/report-payment", {
    method: "POST",
    body: JSON.stringify({
      order_number: orderResponse.order.order_number,
      purchaser_name: purchaserName,
      phone_last3: phoneLast3,
      payment_amount: orderResponse.order.total_amount,
      payment_last5: "67890",
    }),
  });

  await requestJson(baseUrl, "/api/confirm-order", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      orderId: orderResponse.order.id,
    }),
  });

  return {
    supplierId: supplierResponse.supplier.id,
    roundId: roundResponse.round.id,
    roundName: roundResponse.round.name,
    productId: productResponse.product.id,
    orderId: orderResponse.order.id,
    orderNumber: orderResponse.order.order_number,
  };
}

async function cleanupPrintArtifactSetup(baseUrl, accessToken, setup) {
  await requestJson(baseUrl, "/api/confirm-shipment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      orderId: setup.orderId,
    }),
  });

  await requestJson(baseUrl, "/api/products", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      id: setup.productId,
      is_active: false,
    }),
  });

  await requestJson(baseUrl, "/api/rounds", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      id: setup.roundId,
      is_open: false,
      name: setup.roundName,
    }),
  });
}

async function assertNotProtectionPage(page, label, baseUrl) {
  const bodyText = (await page.textContent("body")) ?? "";
  if (/Authentication Required|Deployment Protection|Vercel Authentication/i.test(bodyText)) {
    throw new Error(
      `${label} was blocked by Vercel Deployment Protection at ${baseUrl}. Set STAGING_VERCEL_BYPASS_SECRET (or VERCEL_AUTOMATION_BYPASS_SECRET) and rerun.`,
    );
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(readEnv("STAGING_BASE_URL"));
  const args = parseCliArgs(process.argv.slice(2));
  const smokeSummaryPath = resolveSmokeSummaryPath(args);
  const smoke = parseSmokeSummary(smokeSummaryPath);
  if (smoke.status !== "passed") {
    throw new Error(
      `Smoke summary ${smokeSummaryPath} has status ${smoke.status ?? "unknown"}. Run npm run staging:smoke successfully before capturing artifacts.`,
    );
  }
  if (!smoke.baseUrl) {
    throw new Error(
      `Smoke summary ${smokeSummaryPath} is missing baseUrl. Re-run npm run staging:smoke with the updated script first.`,
    );
  }
  if (!sameBaseUrl(smoke.baseUrl, baseUrl)) {
    throw new Error(
      `Smoke summary target ${smoke.baseUrl} does not match STAGING_BASE_URL ${baseUrl}. Refusing to capture mismatched artifacts.`,
    );
  }

  const { accessToken } = await generateAdminAccessToken(baseUrl);
  const skipPublic = process.env.STAGING_SKIP_PUBLIC === "1";
  const purchaserName =
    process.env.STAGING_SMOKE_PURCHASER_NAME?.trim() || "煙霧測試";
  const phoneLast3 = (
    process.env.STAGING_SMOKE_PHONE?.trim() || "0912-000-678"
  )
    .replace(/\D/g, "")
    .slice(-3);
  const artifactsDir = path.join("artifacts", `staging-${smoke.runId}`);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: buildProtectionHeaders(),
  });
  const page = await context.newPage();

  try {
    if (!skipPublic) {
      console.log("Capturing public lookup screenshot");
      await page.goto(appendProtectionQuery(buildUrl(baseUrl, "/lookup")), {
        waitUntil: "domcontentloaded",
      });
      await assertNotProtectionPage(page, "Public lookup capture", baseUrl);
      // Wait for React hydration — domcontentloaded fires before the JS bundle
      // executes, so controlled input onChange handlers aren't wired yet.
      await page.waitForLoadState("networkidle");
      await page.getByPlaceholder("訂購人姓名").fill(purchaserName);
      await page.getByPlaceholder("手機末三碼").fill(phoneLast3);
      await page.getByRole("button", { name: "查詢訂單" }).click();
      await page.getByText(smoke.deliveryOrderNumber).waitFor();
      await page.screenshot({
        path: path.join(artifactsDir, "lookup-results.png"),
        fullPage: true,
      });

      console.log("Capturing signed order detail screenshot");
      await page.getByText(smoke.deliveryOrderNumber).click();
      await page.waitForURL(
        new RegExp(`/order/${smoke.deliveryOrderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
      await page.screenshot({
        path: path.join(artifactsDir, "order-detail.png"),
        fullPage: true,
      });
    }

    console.log("Writing CSV artifact");
    await writeCsvArtifact(
      baseUrl,
      accessToken,
      smoke.roundId,
      path.join(artifactsDir, "orders-export.csv"),
    );

    console.log("Writing notification log artifact");
    await writeApiArtifact(
      baseUrl,
      accessToken,
      `/api/notification-logs?roundId=${encodeURIComponent(smoke.roundId)}`,
      path.join(artifactsDir, "notification-logs.json"),
    );

    console.log("Creating print-artifact fixture");
    const printSetup = await createPrintArtifactSetup(
      baseUrl,
      accessToken,
      smoke.runId,
    );

    try {
      console.log("Capturing shipment print popup");
      await writePrintArtifact(
        baseUrl,
        accessToken,
        printSetup.roundId,
        printSetup.orderId,
        artifactsDir,
      );
    } finally {
      console.log("Cleaning up print-artifact fixture");
      await cleanupPrintArtifactSetup(baseUrl, accessToken, printSetup);
    }

    const manifest = {
      runId: smoke.runId,
      baseUrl,
      smokeSummaryPath,
      roundId: smoke.roundId,
      deliveryOrderNumber: smoke.deliveryOrderNumber,
      pickupOrderNumber: smoke.pickupOrderNumber,
      artifacts: [
        "lookup-results.png",
        "order-detail.png",
        "orders-export.csv",
        "notification-logs.json",
        "shipment-print-popup.png",
        "shipment-print-popup.html",
      ],
    };
    fs.writeFileSync(
      path.join(artifactsDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Staging artifact capture failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
