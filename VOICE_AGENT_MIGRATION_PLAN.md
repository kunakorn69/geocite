# Plan: Convert BlogAI boilerplate → AI Voice + WhatsApp/SMS SaaS

## Context

The current codebase is a Next.js 15 teaching boilerplate ("BlogAI") that wires up Firebase Auth, Firestore, Stripe subscriptions, and a streaming OpenRouter blog generator. The goal is to repurpose it into a production SaaS where users manage a Vapi-powered AI voice agent and send/receive WhatsApp + SMS via Twilio.

**Locked decisions:**
- Full replacement (rip out blog generator + BlogAI branding)
- Voice agent supports both inbound and outbound calls
- Billing stays as the existing flat Stripe Pro subscription; access is gated on `subscriptionStatus ∈ {active, trialing}`

**Critical finding during exploration:** the current middleware matcher in [src/middleware.ts](src/middleware.ts) runs on `/api/*`, and webhook POSTs without a session cookie fall through `handleInvalidToken`, which 307-redirects non-public paths to `/login`. **The existing Stripe webhook is likely silently broken in prod** — any Vapi/Twilio webhook added would hit the same wall. Fixing this is a prerequisite, not an optional cleanup.

---

## Phase 1 — Demolition

Delete:
- [src/app/api/generate/route.ts](src/app/api/generate/route.ts)
- [src/components/dashboard/blog-generator.tsx](src/components/dashboard/blog-generator.tsx)
- [src/lib/firestore/posts.ts](src/lib/firestore/posts.ts)
- [public/setup.html](public/setup.html) (verify BlogAI-branded before deleting)

Strip BlogAI copy (rewrite, don't delete):
- [src/app/layout.tsx](src/app/layout.tsx) — metadata
- [src/components/landing/](src/components/landing/) — hero, pricing, faq, testimonials, footer, cta, features, etc.
- [src/components/dashboard/sidebar.tsx:34](src/components/dashboard/sidebar.tsx#L34) — literal "BlogAI"
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)
- [README.md](README.md), [SETUP.md](SETUP.md), [CLAUDE.md](CLAUDE.md)

Remove `OPENROUTER_API_KEY` from [.env.example](.env.example). Verified OpenRouter is only referenced by the generate route — safe to drop.

**User decision during execution:** product name (placeholder suggestion: `VoiceFlow` / `Reachly` / `LinePilot`).

---

## Phase 2 — Middleware fix (do this early, unblocks everything)

Edit [src/middleware.ts](src/middleware.ts):

```ts
const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms", "/privacy"];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/webhooks/")) return true;
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
```

Also fixes the Stripe webhook as a side effect. Verify by running `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and `stripe trigger checkout.session.completed`.

---

## Phase 3 — Firestore schema + helpers

Rewrite [src/types/firebase.ts](src/types/firebase.ts). Remove `PostDoc`. Extend `UserDoc` with `defaultAssistantId`, `defaultPhoneNumberId`. Add:

```ts
interface AssistantDoc { id; uid; vapiAssistantId; name; systemPrompt;
  firstMessage; voiceProvider; voiceId; model; createdAt; updatedAt; }

interface PhoneNumberDoc { id; uid; vapiPhoneNumberId; e164;
  provider: "vapi"|"twilio-byo"; inboundAssistantId; label; createdAt; }

interface ContactDoc { id; uid; e164; name; notes; tags;
  lastContactedAt; createdAt; updatedAt; }

interface CallDoc { id; uid; vapiCallId; assistantId; contactId;
  fromE164; toE164; direction: "inbound"|"outbound";
  status: "queued"|"ringing"|"in-progress"|"completed"|"failed"|"no-answer";
  startedAt; endedAt; durationSec; recordingUrl;
  transcript: { role; text; at }[]; endOfCallReport; cost; createdAt; }

interface MessageDoc { id; uid; contactId;
  channel: "sms"|"whatsapp"; direction: "inbound"|"outbound";
  fromE164; toE164; body; mediaUrls: string[];
  status: "queued"|"sent"|"delivered"|"read"|"failed"|"received";
  twilioSid; errorCode; createdAt; }
```

New CRUD files mirroring [src/lib/firestore/users.ts](src/lib/firestore/users.ts):
- `src/lib/firestore/assistants.ts`
- `src/lib/firestore/phone-numbers.ts`
- `src/lib/firestore/contacts.ts` — include `findContactByE164(uid, e164)` for inbound lookup
- `src/lib/firestore/calls.ts` — `upsertCall(vapiCallId, data)`, `appendTranscript(callId, segment)`, `listCalls(uid, opts)`
- `src/lib/firestore/messages.ts` — `upsertMessage(twilioSid, data)`, `listThread(uid, contactId)`, `listInbox(uid)`

Webhook write paths must use `getAdminDb()` (firebase-admin), not the client SDK. Put webhook persistence in `lib/vapi/webhooks.ts` and `lib/twilio/webhooks.ts` — mirrors existing [src/lib/stripe/webhooks.ts](src/lib/stripe/webhooks.ts) pattern.

Add Firestore security rules for each new collection: `request.auth.uid == resource.data.uid`.

---

## Phase 4 — Vapi integration

- `src/lib/vapi/server.ts` — singleton mirroring [src/lib/stripe/server.ts](src/lib/stripe/server.ts), using `@vapi-ai/server-sdk` and `VAPI_API_KEY`
- `src/lib/vapi/signature.ts` — HMAC-SHA256 verification of raw body against `VAPI_WEBHOOK_SECRET` (confirm HMAC vs shared-secret in your Vapi dashboard)
- `src/lib/vapi/webhooks.ts` — `handleCallStarted`, `handleTranscriptDelta`, `handleCallEnded`, `handleEndOfCallReport`
- `src/app/api/webhooks/vapi/route.ts` — `request.text()` → verify → switch on `message.type` → dispatch. Mirrors [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts) exactly
- `src/app/api/calls/start/route.ts` — POST, reads `x-user-uid`, calls `assertActiveSubscription`, body `{ assistantId, toE164, contactId? }`, invokes `vapi.calls.create`, persists initial `CallDoc`, returns `{ callId }`
- `src/app/api/assistants/route.ts` (GET list, POST create) + `src/app/api/assistants/[id]/route.ts` (PATCH/DELETE)

---

## Phase 5 — Twilio integration (SMS + WhatsApp)

- `src/lib/twilio/server.ts` — singleton using `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`
- `src/lib/twilio/signature.ts` — Twilio's `validateRequest(authToken, signature, url, params)`. **Gotcha:** `url` must be the full public URL including query string; behind ngrok/Vercel, read `x-forwarded-proto`/`host` or hardcode from `NEXT_PUBLIC_APP_URL`
- `src/lib/twilio/webhooks.ts` — `handleInboundMessage(form)`, `handleStatusCallback(form)`
- `src/app/api/webhooks/twilio/route.ts` — POST, `request.formData()` (Twilio sends `application/x-www-form-urlencoded`), branch by `From` prefix (`whatsapp:` → WhatsApp, else SMS), persist message, return TwiML `<Response/>`
- `src/app/api/messages/send/route.ts` — POST `{ to, body, channel, contactId? }`, `assertActiveSubscription`, pick `from` by channel, persist with `twilioSid` as doc id

One combined webhook endpoint (discriminated by presence of `MessageStatus` field) is simpler than two — recommended.

---

## Phase 6 — Entitlement gating

New `src/lib/auth/entitlements.ts`:

```ts
export async function assertActiveSubscription(uid: string): Promise<UserDoc> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  const data = snap.data() as UserDoc | undefined;
  if (!data) throw new Response("User not found", { status: 404 });
  if (!["active", "trialing"].includes(data.subscriptionStatus)) {
    throw new Response("Subscription required", { status: 402 });
  }
  return data;
}
```

Wrap every outbound API route (`/api/calls/start`, `/api/messages/send`, `/api/assistants`) in `try { await assertActiveSubscription(uid) } catch (e) { if (e instanceof Response) return e; throw }`.

Client-side: `useEntitlement()` hook reading the user doc via `onSnapshot`, returning `{ active: boolean }`. Drives lock UI on dashboard pages.

---

## Phase 7 — Dashboard UI

Update `NAV_ITEMS` at [src/components/dashboard/sidebar.tsx:16-20](src/components/dashboard/sidebar.tsx#L16-L20):

```ts
{ href: "/dashboard", label: "Overview", icon: Home },
{ href: "/dashboard/calls", label: "Calls", icon: Phone },
{ href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
{ href: "/dashboard/assistants", label: "Assistants", icon: Bot },
{ href: "/dashboard/contacts", label: "Contacts", icon: Users },
{ href: "/dashboard/settings", label: "Settings", icon: Settings },
```

New routes under [src/app/(dashboard)/](src/app/(dashboard)/):
- `dashboard/page.tsx` — rewrite: 3 stat cards + recent activity (combined calls+messages, last 10)
- `dashboard/assistants/page.tsx` + `assistants/[id]/page.tsx` — form with system prompt, voice picker, first message
- `dashboard/calls/page.tsx` — table (date/contact/direction/duration/status), row → drawer with transcript + audio
- `dashboard/messages/page.tsx` — two-pane: contact list / thread / composer
- `dashboard/contacts/page.tsx` — table + create dialog; row actions: Call / SMS / WhatsApp
- `dashboard/settings/page.tsx` — keep existing, add phone-number management section

Realtime via Firestore `onSnapshot` — no new infra.

---

## Phase 8 — Env vars

Add to [.env.example](.env.example):

```
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_WEBHOOK_AUTH_TOKEN=
```

Remove `OPENROUTER_API_KEY`.

---

## Verification

1. `ngrok http 3000`
2. **Middleware fix:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; `stripe trigger checkout.session.completed` → 200
3. **Vapi inbound:** point Vapi webhook at `ngrok-url/api/webhooks/vapi`; place a test call to your Vapi number; confirm `CallDoc` created and transcript segments append
4. **Vapi outbound:** POST `/api/calls/start` from Contacts UI; observe status transitions
5. **Twilio SMS inbound:** point Twilio messaging webhook at `ngrok-url/api/webhooks/twilio`; text the number; confirm thread + realtime UI update
6. **Twilio WhatsApp inbound:** join Twilio WhatsApp Sandbox; send message; confirm `channel: "whatsapp"` discrimination
7. **Messaging outbound:** send from thread composer for both channels
8. **Gating:** cancel test subscription in Stripe dashboard → confirm 402 from `/api/calls/start` and `/api/messages/send`

---

## Risks and decisions during execution

- **Cost runaway:** flat subscription + unbounded Vapi minutes = one user can drain your budget. Flag a follow-up for a monthly minute cap on `UserDoc` incremented in `handleCallEnded`.
- **Transcript size:** Firestore 1 MiB doc limit. Inline transcript works for <30 min calls. For longer, move to `calls/{id}/segments` subcollection.
- **WhatsApp 24h session rule:** outside the 24h window since inbound, only approved templates send. Boilerplate surfaces Twilio error 63016 in UI copy rather than enforcing proactively.
- **Vapi auth type:** confirm HMAC vs shared-secret in your Vapi dashboard — `verifyVapiSignature` implementation differs ~5 lines.
- **Voice provider keys:** configure 11Labs/PlayHT org-wide in Vapi dashboard for boilerplate simplicity; don't surface per-user.
- **Rate limiting** on outbound APIs — not included; someone with a leaked session can burn credits. Post-MVP.
- **Decisions to make while executing:** product name; default voice ID; Vapi-purchased numbers vs BYO Twilio; expose assistant creation to end users vs pre-seed one.

---

## Critical files

- [src/middleware.ts](src/middleware.ts) — webhook path fix (Phase 2)
- [src/types/firebase.ts](src/types/firebase.ts) — schema rewrite (Phase 3)
- [src/lib/stripe/webhooks.ts](src/lib/stripe/webhooks.ts) + [src/app/api/webhooks/stripe/route.ts](src/app/api/webhooks/stripe/route.ts) — pattern template for Vapi/Twilio webhooks
- [src/lib/firestore/users.ts](src/lib/firestore/users.ts) — CRUD helper pattern to mirror
- [src/components/dashboard/sidebar.tsx](src/components/dashboard/sidebar.tsx) — nav update (Phase 7)
