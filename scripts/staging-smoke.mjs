#!/usr/bin/env node

import process from "node:process";
import { randomUUID } from "node:crypto";

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(buildUrl(baseUrl, path), {
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
      `${options.method ?? "GET"} ${path} failed (${response.status}): ${
        typeof payload === "string"
          ? payload
          : payload?.error ?? JSON.stringify(payload)
      }`,
    );
  }

  return payload;
}

function buildAdminHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getPhoneLast3(phone) {
  return phone.replace(/\D/g, "").slice(-3);
}

async function main() {
  const baseUrl = readEnv("STAGING_BASE_URL");
  const adminBearerToken = readEnv("STAGING_ADMIN_BEARER_TOKEN");
  const purchaserName = process.env.STAGING_SMOKE_PURCHASER_NAME?.trim() || "煙霧測試";
  const phone = process.env.STAGING_SMOKE_PHONE?.trim() || "0912-000-678";
  const email = process.env.STAGING_SMOKE_EMAIL?.trim() || "smoke@example.com";
  const address = process.env.STAGING_SMOKE_ADDRESS?.trim() || "台北市信義區煙霧測試路 1 號";
  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const phoneLast3 = getPhoneLast3(phone);
  const created = {};

  console.log(`Starting staging smoke against ${baseUrl}`);
  console.log(`Run ID: ${runId}`);

  const supplierPayload = {
    name: `Smoke Supplier ${runId}`,
    contact_name: "Smoke Runner",
    phone,
    email,
    note: "Created by scripts/staging-smoke.mjs",
  };
  const supplierResponse = await requestJson(baseUrl, "/api/suppliers", {
    method: "POST",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify(supplierPayload),
  });
  created.supplier = supplierResponse.supplier;
  console.log(`Created supplier ${created.supplier.id}`);

  const roundPayload = {
    name: `Smoke Round ${runId}`,
    deadline: null,
    shipping_fee: 60,
    pickup_option_a: "測試面交 A",
    pickup_option_b: "測試面交 B",
  };
  const roundResponse = await requestJson(baseUrl, "/api/rounds", {
    method: "POST",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify(roundPayload),
  });
  created.round = roundResponse.round;
  console.log(`Created round ${created.round.id}`);

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
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify(productPayload),
  });
  created.product = productResponse.product;
  console.log(`Created product ${created.product.id}`);

  const deliveryOrderResponse = await requestJson(baseUrl, "/api/submit-order", {
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
  });
  created.deliveryOrder = deliveryOrderResponse.order;
  console.log(`Created delivery order ${created.deliveryOrder.order_number}`);

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
  console.log(`Created pickup order ${created.pickupOrder.order_number}`);

  const lookupResponse = await requestJson(baseUrl, "/api/lookup", {
    method: "POST",
    body: JSON.stringify({
      purchaser_name: purchaserName,
      phone_last3: phoneLast3,
    }),
  });
  console.log(`Lookup returned ${lookupResponse.orders.length} order(s)`);

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
  console.log(`Reported payment for ${created.deliveryOrder.order_number}`);

  await requestJson(baseUrl, "/api/confirm-order", {
    method: "POST",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify({
      orderId: created.deliveryOrder.id,
    }),
  });
  console.log(`Confirmed payment for ${created.deliveryOrder.order_number}`);

  await requestJson(baseUrl, "/api/notify-arrival", {
    method: "POST",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify({
      productId: created.product.id,
      roundId: created.round.id,
    }),
  });
  console.log(`Queued arrival notification for ${created.product.id}`);

  await requestJson(baseUrl, "/api/confirm-shipment", {
    method: "POST",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify({
      orderId: created.deliveryOrder.id,
    }),
  });
  console.log(`Confirmed shipment for ${created.deliveryOrder.order_number}`);

  await requestJson(baseUrl, "/api/cancel-order", {
    method: "POST",
    body: JSON.stringify({
      order_number: created.pickupOrder.order_number,
      purchaser_name: purchaserName,
      phone_last3: phoneLast3,
    }),
  });
  console.log(`Cancelled pickup order ${created.pickupOrder.order_number}`);

  await requestJson(baseUrl, "/api/products", {
    method: "PUT",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify({
      id: created.product.id,
      is_active: false,
    }),
  });
  await requestJson(baseUrl, "/api/rounds", {
    method: "PUT",
    headers: buildAdminHeaders(adminBearerToken),
    body: JSON.stringify({
      id: created.round.id,
      is_open: false,
      name: created.round.name,
    }),
  });

  console.log("");
  console.log("Automated staging smoke complete.");
  console.log("Follow docs/staging-smoke-runbook.md for provider/browser/manual checks.");
  console.log(
    JSON.stringify(
      {
        runId,
        supplierId: created.supplier.id,
        roundId: created.round.id,
        productId: created.product.id,
        deliveryOrderNumber: created.deliveryOrder.order_number,
        pickupOrderNumber: created.pickupOrder.order_number,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Staging smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
