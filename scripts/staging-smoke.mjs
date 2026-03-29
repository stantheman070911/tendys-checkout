#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { randomUUID } from "node:crypto";
import {
  buildSmokeArtifactPaths,
  buildUrl,
  createProtectedFetchSession,
  createLineLogger,
  formatRequestFailure,
  hasProtectionBypassSecret,
  normalizeBaseUrl,
  readEnv,
  writeJson,
} from "./lib/staging-support.mjs";

const protectedFetch = createProtectedFetchSession();

async function requestJson(baseUrl, path, options = {}) {
  let response;
  try {
    response = await protectedFetch.fetch(buildUrl(baseUrl, path), {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      formatRequestFailure(
        baseUrl,
        path,
        options.method ?? "GET",
        response.status,
        payload,
      ),
    );
  }

  return payload;
}

function getPhoneLast3(phone) {
  return phone.replace(/\D/g, "").slice(-3);
}

function runDbValidation(logger) {
  logger.log("Running DB schema validation before smoke...");
  const result = spawnSync("npm", ["run", "db:validate"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });

  if (result.stdout) {
    logger.log(result.stdout.trim());
  }
  if (result.stderr) {
    logger.log(result.stderr.trim());
  }

  if (result.status !== 0) {
    throw new Error("DB schema validation failed before staging smoke.");
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const { logPath, summaryPath } = buildSmokeArtifactPaths(runId);
  const logger = createLineLogger(logPath);
  const summary = {
    runId,
    logPath,
    summaryPath,
    bypassConfigured: hasProtectionBypassSecret(),
    status: "failed",
  };
  try {
    const baseUrl = normalizeBaseUrl(readEnv("STAGING_BASE_URL"));
    summary.baseUrl = baseUrl;
    const adminBearerToken = readEnv("STAGING_ADMIN_BEARER_TOKEN");
    const purchaserName =
      process.env.STAGING_SMOKE_PURCHASER_NAME?.trim() || "煙霧測試";
    const phone = process.env.STAGING_SMOKE_PHONE?.trim() || "0912-000-678";
    const email =
      process.env.STAGING_SMOKE_EMAIL?.trim() || "smoke@example.com";
    const address =
      process.env.STAGING_SMOKE_ADDRESS?.trim() ||
      "台北市信義區煙霧測試路 1 號";
    const phoneLast3 = getPhoneLast3(phone);
    const created = {};

    logger.log(`Starting staging smoke against ${baseUrl}`);
    logger.log(`Run ID: ${runId}`);
    runDbValidation(logger);
    logger.log(
      hasProtectionBypassSecret()
        ? "Vercel preview protection bypass is configured for this run."
        : "No Vercel preview protection bypass secret is configured for this run.",
    );

    await requestJson(baseUrl, "/api/admin/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminBearerToken}`,
      },
    });
    logger.log("Established admin session cookie from /api/admin/session");

    const supplierPayload = {
      name: `Smoke Supplier ${runId}`,
      contact_name: "Smoke Runner",
      phone,
      email,
      note: "Created by scripts/staging-smoke.mjs",
    };
    const supplierResponse = await requestJson(baseUrl, "/api/suppliers", {
      method: "POST",
      body: JSON.stringify(supplierPayload),
    });
    created.supplier = supplierResponse.supplier;
    summary.supplierId = created.supplier.id;
    logger.log(`Created supplier ${created.supplier.id}`);

    const roundPayload = {
      name: `Smoke Round ${runId}`,
      deadline: null,
      shipping_fee: 60,
      pickup_option_a: "測試面交 A",
      pickup_option_b: "測試面交 B",
    };
    const roundResponse = await requestJson(baseUrl, "/api/rounds", {
      method: "POST",
      body: JSON.stringify(roundPayload),
    });
    created.round = roundResponse.round;
    summary.roundId = created.round.id;
    logger.log(`Created round ${created.round.id}`);

    const productPayload = {
      name: `Smoke Product ${runId}`,
      price: 120,
      unit: "袋",
      round_id: created.round.id,
      supplier_id: created.supplier.id,
      stock: 20,
      goal_qty: 10,
      image_url: null,
    };
    const productResponse = await requestJson(baseUrl, "/api/products", {
      method: "POST",
      body: JSON.stringify(productPayload),
    });
    created.product = productResponse.product;
    summary.productId = created.product.id;
    logger.log(`Created product ${created.product.id}`);

    const deliveryOrderResponse = await requestJson(
      baseUrl,
      "/api/submit-order",
      {
        method: "POST",
        body: JSON.stringify({
          round_id: created.round.id,
          nickname: `smoke-${runId}`,
          purchaser_name: purchaserName,
          recipient_name: purchaserName,
          phone,
          address,
          email,
          pickup_location: "",
          items: [
            {
              product_id: created.product.id,
              quantity: 1,
            },
          ],
          submission_key: randomUUID(),
          note: "Delivery smoke order",
          save_profile: false,
        }),
      },
    );
    created.deliveryOrder = deliveryOrderResponse.order;
    summary.deliveryOrderNumber = created.deliveryOrder.order_number;
    logger.log(`Created delivery order ${created.deliveryOrder.order_number}`);

    const pickupOrderResponse = await requestJson(baseUrl, "/api/submit-order", {
      method: "POST",
      body: JSON.stringify({
        round_id: created.round.id,
        nickname: `smoke-${runId}`,
        purchaser_name: purchaserName,
        recipient_name: purchaserName,
        phone,
        address,
        email,
        pickup_location: "測試面交 A",
        items: [
          {
            product_id: created.product.id,
            quantity: 1,
          },
        ],
        submission_key: randomUUID(),
        note: "Pickup smoke order",
        save_profile: false,
      }),
    });
    created.pickupOrder = pickupOrderResponse.order;
    summary.pickupOrderNumber = created.pickupOrder.order_number;
    logger.log(`Created pickup order ${created.pickupOrder.order_number}`);

    const lookupResponse = await requestJson(baseUrl, "/api/lookup", {
      method: "POST",
      body: JSON.stringify({
        purchaser_name: purchaserName,
        phone_last3: phoneLast3,
      }),
    });
    logger.log(`Lookup returned ${lookupResponse.orders.length} order(s)`);

    await requestJson(baseUrl, "/api/report-payment", {
      method: "POST",
      body: JSON.stringify({
        order_number: created.deliveryOrder.order_number,
        purchaser_name: purchaserName,
        phone_last3: phoneLast3,
        payment_amount: created.deliveryOrder.total_amount,
        payment_last5: "12345",
      }),
    });
    logger.log(`Reported payment for ${created.deliveryOrder.order_number}`);

    await requestJson(baseUrl, "/api/confirm-order", {
      method: "POST",
      body: JSON.stringify({
        orderId: created.deliveryOrder.id,
      }),
    });
    logger.log(`Confirmed payment for ${created.deliveryOrder.order_number}`);

    await requestJson(baseUrl, "/api/notify-arrival", {
      method: "POST",
      body: JSON.stringify({
        productId: created.product.id,
        roundId: created.round.id,
      }),
    });
    logger.log(`Queued arrival notification for ${created.product.id}`);

    await requestJson(baseUrl, "/api/confirm-shipment", {
      method: "POST",
      body: JSON.stringify({
        orderId: created.deliveryOrder.id,
      }),
    });
    logger.log(`Confirmed shipment for ${created.deliveryOrder.order_number}`);

    await requestJson(baseUrl, "/api/cancel-order", {
      method: "POST",
      body: JSON.stringify({
        order_number: created.pickupOrder.order_number,
        purchaser_name: purchaserName,
        phone_last3: phoneLast3,
      }),
    });
    logger.log(`Cancelled pickup order ${created.pickupOrder.order_number}`);

    await requestJson(baseUrl, "/api/products", {
      method: "PUT",
      body: JSON.stringify({
        id: created.product.id,
        is_active: false,
      }),
    });
    await requestJson(baseUrl, "/api/rounds", {
      method: "PUT",
      body: JSON.stringify({
        id: created.round.id,
        is_open: false,
        name: created.round.name,
      }),
    });

    summary.status = "passed";
    writeJson(summaryPath, summary);

    logger.log("");
    logger.log("Automated staging smoke complete.");
    logger.log("Follow docs/staging-smoke-runbook.md for provider/browser/manual checks.");
    logger.log(`Smoke log written to ${logPath}`);
    logger.log(`Smoke summary written to ${summaryPath}`);
    logger.log(summary);
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    writeJson(summaryPath, summary);
    logger.log("");
    logger.log("Automated staging smoke failed.");
    logger.log(summary.error);
    logger.log(`Smoke log written to ${logPath}`);
    logger.log(`Smoke summary written to ${summaryPath}`);
    throw error;
  }
}

main().catch((error) => {
  console.error("Staging smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
