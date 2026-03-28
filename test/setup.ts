import { afterEach } from "vitest";
import { resetRateLimitStoreForTests } from "@/lib/rate-limit";

afterEach(() => {
  resetRateLimitStoreForTests();
});
