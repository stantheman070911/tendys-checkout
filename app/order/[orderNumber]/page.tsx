import { cookies } from "next/headers";
import { PublicOrderPage } from "@/components/PublicOrderPage";
import { findPublicOrderByOrderNumberAndIdentity } from "@/lib/db/orders";
import { hasUnderGoalProductsByRound } from "@/lib/db/products";
import {
  getPublicOrderAccessCookieName,
  verifyPublicOrderAccessToken,
} from "@/lib/public-order-access";
import { isEnvironmentConfigurationError } from "@/lib/server-env";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orderNumber } = await params;
  const { error } = await searchParams;
  const resolvedOrderNumber = decodeURIComponent(orderNumber).toUpperCase();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(
    getPublicOrderAccessCookieName(resolvedOrderNumber),
  )?.value;
  let resolvedError = error;
  let claims = null;

  try {
    claims = verifyPublicOrderAccessToken(accessToken);
  } catch (validationError) {
    if (isEnvironmentConfigurationError(validationError)) {
      resolvedError ||= "service_unavailable";
    } else {
      throw validationError;
    }
  }

  const identity =
    claims?.order_number === resolvedOrderNumber
      ? {
          purchaser_name: claims.purchaser_name,
          phone_last3: claims.phone_last3,
        }
      : null;

  const order = identity
    ? await findPublicOrderByOrderNumberAndIdentity(
        resolvedOrderNumber,
        identity.purchaser_name,
        identity.phone_last3,
      )
    : null;

  const anyUnderGoal =
    order?.round_id ? await hasUnderGoalProductsByRound(order.round_id) : false;

  return (
    <PublicOrderPage
      orderNumber={resolvedOrderNumber}
      order={order}
      anyUnderGoal={anyUnderGoal}
      identity={identity}
      error={resolvedError}
    />
  );
}
