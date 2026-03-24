const DEFAULT_DELIVERY_LABEL = "宅配到以上地址";
export const DEFAULT_PICKUP_OPTION_A = "面交點 A";
export const DEFAULT_PICKUP_OPTION_B = "面交點 B";
export const DELIVERY_PICKUP_VALUE = "";
export const DELIVERY_SELECT_SENTINEL = "__delivery__";
const MAX_PICKUP_OPTION_LENGTH = 100;

type RoundPickupConfig = {
  pickup_option_a?: string | null;
  pickup_option_b?: string | null;
};

export interface PickupOption {
  value: string;
  label: string;
}

function normalizePickupLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function getRoundPickupConfig(round?: RoundPickupConfig | null) {
  return {
    pickup_option_a: normalizePickupLabel(
      round?.pickup_option_a,
      DEFAULT_PICKUP_OPTION_A,
    ),
    pickup_option_b: normalizePickupLabel(
      round?.pickup_option_b,
      DEFAULT_PICKUP_OPTION_B,
    ),
  };
}

export function getRoundPickupOptions(
  round?: RoundPickupConfig | null,
): PickupOption[] {
  const { pickup_option_a, pickup_option_b } = getRoundPickupConfig(round);

  return [
    { value: DELIVERY_PICKUP_VALUE, label: DEFAULT_DELIVERY_LABEL },
    { value: pickup_option_a, label: pickup_option_a },
    { value: pickup_option_b, label: pickup_option_b },
  ];
}

export function isValidRoundPickupLocation(
  round: RoundPickupConfig | null | undefined,
  pickupLocation: string,
): boolean {
  if (pickupLocation === DELIVERY_PICKUP_VALUE) {
    return true;
  }

  const { pickup_option_a, pickup_option_b } = getRoundPickupConfig(round);
  return (
    pickupLocation === pickup_option_a || pickupLocation === pickup_option_b
  );
}

export function validatePickupOptionLabels(
  pickupOptionA: string,
  pickupOptionB: string,
):
  | {
      ok: true;
      pickup_option_a: string;
      pickup_option_b: string;
    }
  | {
      ok: false;
      error: string;
    } {
  const normalizedA = pickupOptionA.trim();
  const normalizedB = pickupOptionB.trim();

  if (!normalizedA || !normalizedB) {
    return { ok: false, error: "面交點 A / B 都必須填寫" };
  }

  if (
    normalizedA.length > MAX_PICKUP_OPTION_LENGTH ||
    normalizedB.length > MAX_PICKUP_OPTION_LENGTH
  ) {
    return {
      ok: false,
      error: `面交點名稱不可超過 ${MAX_PICKUP_OPTION_LENGTH} 字`,
    };
  }

  if (normalizedA === normalizedB) {
    return { ok: false, error: "面交點 A / B 不能相同" };
  }

  if (
    normalizedA === DELIVERY_SELECT_SENTINEL ||
    normalizedB === DELIVERY_SELECT_SENTINEL
  ) {
    return { ok: false, error: "面交點名稱不可使用系統保留字" };
  }

  return {
    ok: true,
    pickup_option_a: normalizedA,
    pickup_option_b: normalizedB,
  };
}
