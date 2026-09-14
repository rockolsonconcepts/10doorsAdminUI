# 10Doors Admin UI

Internal admin console for the 10Doors platform. Access requires an account with the
system-level `SYSTEM_ADMIN` entitlement (the default Administrator); the backend enforces
this on every `/v1/admin/**` and `/v1/marketing/**` call, and the UI signs out any user whose
`GET /v1/admin/me` response has `systemAdmin: false`.

## Modules

- **Overview** – public `/v1/health` probe (polled), DB status, uptime/version/profiles, traced-error counts, marketing agent state.
- **Traced Errors** – paginated `/v1/admin/traced-errors` with time window + errorCode filter; detail shows stack trace and captured request payload.
- **Clients & Admins** – administrators, clients (secrets redacted server-side), entitlements lookup by subject id.
- **Marketing Agent** – approval queue, publications (manual post + record result), agent activity audit log, reference data (objectives, campaigns, segments, channels, rules, insights), content charter.

## Using the console

### Signing in

Sign in with the platform **Administrator** account (`administrator.email` / `administrator.password`
in the backend config), not a landlord account. Login resolves identity in the order
property manager → tenant → administrator, so an email that also exists as a landlord will
log in as the landlord and be rejected by the admin gate.

### Overview

Landing page. Confirms the backend is reachable (`/v1/health`), shows DB status, uptime,
version and active profiles, the count of recent traced errors, and whether the marketing
agent is enabled (`marketing.agent.enabled`) along with its last tick. If the agent shows
disabled, nothing below will produce new proposals.

### Traced Errors

Every backend exception is stored with a `tracedErrorId`; API error responses include that id.
Paste an id from a user report (or filter by time window / `errorCode`) and open the row to
see the stack trace and the captured request payload.

### Clients & Admins

Read-only view of administrators, OAuth clients (secrets redacted) and an entitlement lookup
by subject id. Use it to confirm which account holds `SYSTEM_ADMIN` and which client is the
platform default.

## Marketing Agent

The agent runs in the backend on a schedule and never acts externally on its own. Each tick
reads the database, optionally calls the LLM, and writes **proposals** back as `AgentAction`s
in `PENDING_REVIEW`. The console is where you approve them and close the loop.

```
Observe (every 30 min)  metrics snapshot: business, GA4, engagement, conversions
Plan    (daily 06:00)   situation brief -> LLM -> ContentIdea proposals   -> queue
Create  (on approval)   idea + charter + audience -> LLM -> ContentAsset  -> queue
Publish (on approval)   guard checks -> ChannelAdapter -> Publication
Learn   (Mon 07:00)     experiments/conversions -> MarketingInsight, StrategyRule -> queue
```

### Getting started (first run)

Do these once, in order, before enabling the agent. Skipping steps 2–4 produces generic
"try our software" posts.

1. **Turn it on** – set `marketing.agent.enabled=true` and `openai.api-key` on the backend (see
   *Turning the agent on*). Overview shows the agent state and last tick.
2. **Reference Data** – create objectives (what to grow), 2–3 audience segments with *real*
   pain points in the audience's own words, one campaign with a hypothesis, and one channel row
   per destination. Enable only the channels you will actually post to.
3. **Content Charter** – write the voice and content principles, banned phrases, a good and a
   bad example, and set the promotional share (default 20%) and product-mention cap.
4. **Listening** – paste 5–10 real threads/questions you have seen the audience post. This is
   the raw material for the first Plan; without it the model only has the segments to go on.
5. Wait for the next Plan tick (06:00 by default) or watch **Agent Activity** for `PLAN`.
   Ideas appear in the **Approval Queue**.

### Daily loop

1. **Listening** (2 minutes) – paste anything relevant you saw since yesterday; mark older
   observations `REVIEWED` once you have read them so the brief stays focused.
2. **Approval Queue** – review pending actions. Each card shows the action type
   (`CREATE_IDEA`, `CREATE_CONTENT`, `PUBLISH`, `CREATE_INSIGHT`, `CREATE_STRATEGY_RULE`, ...)
   and the proposed payload. For ideas and drafts the first field is the **intent**
   (`EDUCATE`, `STORY`, `DISCUSSION`, `ANSWER`, `PROMOTE`) so you can see what kind of piece it
   is before reading it. Approve or reject with a short reason — rejections are the cheapest
   way to teach the agent; encode recurring reasons into the Content Charter (below).
   - Approving `CREATE_IDEA` triggers drafting on the next execute tick (every 5 min).
   - Approving `CREATE_CONTENT` proposes a `PUBLISH` action.
   - Approving `PUBLISH` runs the guards and hands the post to the channel adapter.
3. **Publications** – with the manual adapter (the only one today) an approved publication
   lands here as `SCHEDULED`. Select it, copy the drafted title/hook/body/CTA, and follow the
   **How to use this link** panel: it shows the full tracked URL (`…/go/{code}`) and
   channel-specific placement instructions (Reddit/Threads: link in the post; Instagram feed:
   link-in-bio + "link in bio" in the caption; Instagram story: link sticker). Post it yourself,
   then **Record result** with the live URL / external id and status `PUBLISHED` (or `FAILED`
   with a reason). Recording the result is what lets engagement and conversions be attributed.
4. **Agent Activity** – audit log of every tick and action, including LLM-free ones, with
   model, tokens, guard decisions and failure reasons. Check it when the queue is unexpectedly
   empty ("why did it do nothing" is logged too) and to watch token spend against
   `marketing.agent.daily-token-budget`.

### Weekly

- Monday's Learn tick proposes `CREATE_INSIGHT` / `CREATE_STRATEGY_RULE` actions once a
  campaign has enough data (`min-sample-size`). Approve the ones you believe; they are read
  by every later Plan.
- Skim **Reference Data → Insights / Strategy rules** and retire anything stale.
- If you rejected several drafts for the same reason, encode it in the **Content Charter**
  (banned phrase, principle, or a lower promotional share) rather than rejecting again.

### Listening

Where the agent learns what the audience is actually saying. Every `NEW` observation is
included verbatim (channel, location, title, snippet, topic, sentiment) in the next daily Plan
brief, so the ideas the model proposes answer real questions instead of imagined ones.

**Adding an observation**

1. Pick a configured **Channel**, or leave it empty and choose a **Channel type** (e.g. `REDDIT`
   before you have a Reddit channel row).
2. **Location** – where you saw it: `r/Landlord`, `#landlordlife`, a Facebook group name.
3. **Source URL** – the thread or post link. It also acts as the dedupe key: pasting the same
   URL twice returns the existing observation instead of creating another.
4. **Title** – the post title if there is one.
5. **Snippet** (required) – the part that matters, in the author's own words. Keep the
   frustration and the specifics ("third month of Zelle in three chunks"); that is what makes
   the resulting content relatable. Do not paste personal data beyond what is public.
6. **Author**, **Sentiment**, optional **Topic** – topic is free text (`late rent`,
   `security deposit`); use consistent labels so Learn can group them later.

Channel, type and location are kept after saving so a batch from one subreddit is quick.

**Working the list** – the filter defaults to `NEW`. After a Plan tick has consumed an
observation (or you have read it) mark it **Reviewed**; use **Ignore** for noise. Both remove it
from future briefs; **Restore** on an ignored row puts it back to `NEW`. `ACTIONED` is reserved
for observations that led to a content idea (set via the API today; the UI will do it once the
planner links ideas back to observations).

**What goes in** – questions, complaints, "how do you handle X" threads, comments on competitor
posts, support emails you have permission to use. **What does not** – anything you would not
want quoted back in a brief; observations are prompt context only and are never used to train a
model.

Reddit must be fed this way: its Developer Terms treat use by a business as commercial and
prohibit automated posting, so there is no Reddit API integration. Threads and Instagram
observers can populate the same list automatically once those adapters exist.

### Tracked links and attribution

Every publication gets its own `AttributionLink`; the tracked URL is
`{marketing.agent.tracking-base-url}/go/{code}`. Clicks are counted either by the backend
redirect (`GET /go/{slug}`) or by the landing page's `/go/{slug}` route calling
`POST /go/{slug}/click`. The landing page stores `ref` + UTMs, the app sends them on
registration, and Stripe lifecycle events add `TRIAL_STARTED` / `SUBSCRIPTION_STARTED`, so a
post can be followed through to paid users.

For channels that don't allow a link per post, create a **campaign link** from the
Publications screen (campaign-scoped, optional vanity path such as `/go/latefees`) and use it
as the bio link for the campaign's duration. One URL form per published link — don't share
both the redirect URL and the landing-page URL for the same post or clicks double-count.

### Content Charter

The persisted editorial brief that is injected into every LLM call and enforced by the guard:

- **Voice, audience truths, content principles, product-mention guidance** – free text; this is
  where "write for people living a landlord problem, not people shopping for software" lives.
- **Banned phrases** – one per line; any draft containing one is blocked before review.
- **Good / bad example** – shown to the model as calibration.
- **Max promotional share** – percent of a channel's trailing-7-day posts that may be `PROMOTE`;
  the guard blocks a promotional publication that would exceed it.
- **Max product mentions** – how many times a non-`PROMOTE` draft may name the product.

Until you save, the screen shows the built-in defaults (20% promotional, 1 mention). Edit the
charter whenever you find yourself rejecting drafts for the same reason.

### Reference Data

- **Objectives** – what the agent is optimising (registrations, trials, paid subscriptions) with
  current/target values refreshed by Observe.
- **Campaigns** – groupings of ideas with a hypothesis; the Learn step evaluates them.
- **Audience segments** – pain points and interests fed into the draft brief. The richer these
  are, the more relatable the content; a few words each produces generic posts.
- **Channels** – one row per destination (`REDDIT`, `THREADS`, `INSTAGRAM`, ...), with handle,
  capabilities, `maxPostsPerDay` and an Enable/Disable toggle. Disabled channels never receive
  proposals. Channels are created via `POST /v1/marketing/channels` (or the dev seed);
  the UI toggles them.
- **Strategy rules** – `POLICY`/`PLATFORM` rules the guard enforces, `STRATEGY`/`PREFERENCE`
  rules the model reads. Agent-proposed rules arrive via the queue; activate/retire them here.
- **Insights** – validated learnings; toggle active to include/exclude them from the brief.

### Turning the agent on

Backend properties (`marketing.agent.*`):

| Property | Purpose |
| --- | --- |
| `enabled` | master switch (default `false`) |
| `openai.api-key`, `openai.model` | LLM; without a key the Plan/Create steps skip |
| `google-analytics.property-id`, `google-analytics.credentials-json` | GA4 in Observe; optional |
| `tracking-base-url` | host for tracked links (`https://10doors.io` for landing-page-served links) |
| `landing-url` | redirect destination |
| `cron.observe` / `cron.plan` / `cron.execute` / `cron.learn` | schedules |
| `daily-token-budget`, `max-ideas-per-plan`, `idea-dedupe-days`, `min-sample-size` | guard and learn thresholds |

## Development

```bash
npm install
npm run dev        # http://localhost:5174, proxies /api -> http://localhost:8080
npm run typecheck
npm run lint
npm run build      # build:staging / build:prod for other modes
```

Run the backend locally with the `dev` profile. Sign in with the dev administrator credentials.

## Configuration

Resolution order: `public/config/app-config.json` (runtime, replaced at deploy) → `VITE_*` from
`.env.<mode>` → defaults. Keys: `apiBaseUrl`, `clientId`, `clientSecret`, `apiKey`, `scope`.
`x-api-key` is sent on every request (including token calls) when configured.
