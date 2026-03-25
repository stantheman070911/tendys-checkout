import { describe, expect, it } from "vitest";
import { getCsvExportErrorMessage } from "./csv-export";

describe("getCsvExportErrorMessage", () => {
  it("maps auth failures to a relogin prompt", () => {
    expect(getCsvExportErrorMessage(401)).toBe(
      "登入已過期，請重新登入後再試一次",
    );
  });

  it("maps bad requests to a refresh prompt", () => {
    expect(getCsvExportErrorMessage(400)).toBe(
      "匯出參數錯誤，請重新整理後再試一次",
    );
  });

  it("falls back to a generic error", () => {
    expect(getCsvExportErrorMessage(500)).toBe("匯出失敗，請稍後再試");
  });
});
