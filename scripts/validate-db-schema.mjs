#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFileIfNeeded() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const candidates = [".env.local", ".env"];
  for (const filename of candidates) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const contents = fs.readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const name = trimmed.slice(0, separator);
      if (process.env[name]) {
        continue;
      }

      process.env[name] = trimmed.slice(separator + 1);
    }

    if (process.env.DATABASE_URL) {
      return;
    }
  }
}

loadEnvFileIfNeeded();

const prisma = new PrismaClient();

const checks = [
  {
    name: "generate_order_number function",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'generate_order_number'
      ) AS ok
    `,
  },
  {
    name: "trg_generate_order_number trigger",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_generate_order_number'
      ) AS ok
    `,
  },
  {
    name: "product_progress view",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_views
        WHERE schemaname = 'public' AND viewname = 'product_progress'
      ) AS ok
    `,
  },
  {
    name: "orders_by_product view",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_views
        WHERE schemaname = 'public' AND viewname = 'orders_by_product'
      ) AS ok
    `,
  },
  {
    name: "single open round partial index",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_rounds_single_open'
      ) AS ok
    `,
  },
  {
    name: "pickup option A non-empty constraint",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rounds_pickup_option_a_nonempty'
      ) AS ok
    `,
  },
  {
    name: "pickup option B non-empty constraint",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rounds_pickup_option_b_nonempty'
      ) AS ok
    `,
  },
  {
    name: "pickup options distinct constraint",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rounds_pickup_options_distinct'
      ) AS ok
    `,
  },
  {
    name: "public lookup composite index",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_users_purchaser_name_lower_phone_last3'
      ) AS ok
    `,
  },
  {
    name: "notification_jobs table",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'notification_jobs'
      ) AS ok
    `,
  },
  {
    name: "notification_jobs worker index",
    query: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_notification_jobs_status_available_at'
      ) AS ok
    `,
  },
];

try {
  const failures = [];

  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe(check.query);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row?.ok) {
      failures.push(check.name);
    }
  }

  if (failures.length > 0) {
    console.error("Database schema validation failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Database schema validation passed (${checks.length} checks).`);
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unknown DB validation failure",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
