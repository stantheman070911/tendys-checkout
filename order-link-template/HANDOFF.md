# Order → LINE Notification Linking — Engineer Handoff

Same crypto code generation pattern, redesigned for group-chat purchase → LINE notification flow.

---

## What This Does

1. User clicks a purchase link shared in a group chat, fills in name / items / etc.
2. On submit → `POST /api/orders` creates an order in the DB and returns an **8-char code** (e.g. `A3KX9P2M`).
3. Frontend shows the code: _"Paste this into our LINE Official Account to receive shipping updates."_
4. User opens LINE OA, pastes the code.
5. Bot validates the code → links the user's LINE ID to their order.
6. When the order ships, call `POST /api/orders/:id/notify` with `{ event: "SHIPPED" }` → LINE push is sent.

---

## Files

```
prisma/
  schema.snippet.prisma       → Add Order + OrderCode models to your schema

lib/
  auth/
    generate-code.ts          → Generates the 8-char alphanumeric code
    validate-order-code.ts    → Validates code, links LINE ID, returns orderId + buyerName
  db/
    order.ts                  → DB queries: createOrder, createCode, getCodeByValue, etc.
  line/
    message-handler.ts        → Handles incoming LINE messages (code paste → validation)
    notify.ts                 → notifyShipped() / notifyDelivered() push helpers

app/api/
  orders/
    route.ts                  → POST /api/orders — creates order, returns code
  orders/[id]/notify/
    route.ts                  → POST /api/orders/:id/notify — triggers LINE push
```

---

## Integration Steps

### 1. Schema
Append `prisma/schema.snippet.prisma` to your `prisma/schema.prisma`, then:
```bash
npx prisma migrate dev --name add-order-models
npx prisma generate
```

### 2. Prisma singleton
`lib/db/order.ts` imports from `lib/db/prisma.ts` — make sure you have a `globalThis` singleton there (same as project-guochenwei). If you're starting fresh, copy `lib/db/prisma.ts` from that project.

### 3. LINE client + reply helper
`lib/line/message-handler.ts` and `notify.ts` import from:
- `./client` — your LINE `@line/bot-sdk` singleton
- `./reply` — `sendLineMessage(lineUserId, text, replyToken?)` with Reply→Push fallback

Copy `lib/line/client.ts` and `lib/line/reply.ts` from project-guochenwei, they work unchanged.

### 4. Webhook handler
Wire `handleMessage` into your LINE webhook route, same as project-guochenwei:

```ts
// app/api/line/webhook/route.ts (relevant snippet)
import { handleMessage } from "@/lib/line/message-handler";

// inside your event loop:
if (event.type === "message" && event.message.type === "text") {
  await handleMessage(
    event.source.userId,
    event.message.text,
    event.replyToken
  );
}
```

### 5. Order DB query — getOrderByLineId
`message-handler.ts` calls `getOrderByLineId(lineUserId)`. Add this to `lib/db/order.ts`:

```ts
export async function getOrderByLineId(lineUserId: string) {
  return prisma.order.findFirst({
    where: { line_user_id: lineUserId },
    orderBy: { created_at: "desc" },
  });
}
```

### 6. Environment variables
Add to `.env.local`:
```
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
DATABASE_URL=...
ADMIN_SECRET=<random secret for the notify endpoint>
ORDER_CODE_TTL_HOURS=48   # optional, defaults to 48
```

### 7. Triggering notifications (from admin panel or backend)
```bash
curl -X POST https://your-domain/api/orders/<orderId>/notify \
  -H "Authorization: Bearer <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{ "event": "SHIPPED", "trackingNumber": "123456789" }'
```

---

## Key Decisions (same as source project)

| Decision | Reason |
|----------|--------|
| 8-char code, 32-char alphabet (no 0/O/1/I/l) | Hard to misread, copy-paste safe |
| `crypto.randomBytes` + `byte % 32` | Zero modulo bias (32 = 2^5) |
| Prisma transaction on validation | Prevents double-use in concurrent requests |
| Reply API first, Push fallback | Reply tokens expire quickly; Push always works |
| `notifyShipped` returns `false` if no LINE user | Order may have been placed by someone who never linked — don't crash |
