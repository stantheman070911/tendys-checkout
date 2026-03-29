/* global __ENV */

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
  scenarios: {
    admin_search: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      exec: "adminSearch",
    },
    csv_export: {
      executor: "per-vu-iterations",
      vus: 2,
      iterations: 4,
      maxDuration: "30s",
      exec: "csvExport",
      startTime: "5s",
    },
    public_round: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      exec: "publicRound",
      startTime: "10s",
    },
  },
};

const baseUrl = __ENV.LOAD_BASE_URL;
const roundId = __ENV.LOAD_ROUND_ID;
const adminCookie = __ENV.LOAD_ADMIN_COOKIE;

if (!baseUrl || !roundId) {
  throw new Error("Set LOAD_BASE_URL and LOAD_ROUND_ID before running the k6 profile.");
}

const adminHeaders = adminCookie
  ? {
      Cookie: adminCookie,
    }
  : {};

export function adminSearch() {
  const response = http.get(
    `${baseUrl}/api/orders?roundId=${roundId}&page=1&pageSize=50&search=test`,
    { headers: adminHeaders },
  );

  check(response, {
    "admin search ok": (res) => res.status === 200,
  });
  sleep(1);
}

export function csvExport() {
  const response = http.get(
    `${baseUrl}/api/export-csv?roundId=${roundId}`,
    { headers: adminHeaders },
  );

  check(response, {
    "csv export ok": (res) => res.status === 200,
  });
  sleep(1);
}

export function publicRound() {
  const response = http.get(`${baseUrl}/api/rounds`);

  check(response, {
    "public round ok": (res) => res.status === 200,
  });
  sleep(1);
}
