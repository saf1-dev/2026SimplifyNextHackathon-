# MotoMoto.ai V2

MotoMoto.ai is an evidence-led Singapore used-motorcycle intelligence POC. Its primary experience is a Chrome/Edge Manifest V3 side panel that reads one user-opened Carousell or SGBikeMart listing, lets the user verify the extracted facts, then stores and compares the listing only after the user presses **Analyse this bike**.

The web product provides the branded landing page and natural-language discovery over current inventory. The supplied 2010+ MotoMoto dataset is migrated as genuine seed evidence; no synthetic motorcycles are used in production.

## What the demo proves

- deterministic marketplace extraction runs before AI;
- only supported listing fields and sanitized description text are processed;
- `POST /api/v1/interpret` never writes to storage;
- `POST /api/v1/analyse` is the explicit ingestion boundary;
- one stable listing can have many observations but counts once as a comparable;
- ambiguous legacy prices remain `UNKNOWN` and never become authoritative by assumption;
- the valuation itself uses deterministic robust statistics—not an LLM;
- low evidence produces low/insufficient confidence instead of a misleading “great deal” label;
- Groq is optional for local development and falls back to conservative rules when absent;
- all secrets stay in backend-only environment configuration.

## Architecture

```text
Carousell / SGBikeMart listing
        │ user opens MotoMoto side panel
        ▼
MV3 extension: deterministic DOM + JSON-LD extraction
        │ sanitized relevant fields only
        ▼
POST /api/v1/interpret ──► Groq (optional interpretation; no pricing, no write)
        │ reviewed by user
        ▼
POST /api/v1/analyse ───► ListingRepository ───► local JSON or DynamoDB
        │                         │ stable listing + append-only observations
        ▼                         ▼
deterministic comparable engine: identity → similarity → freshness → weighted quartiles
        │
        ▼
range + confidence + evidence counts + reason codes + limitations
```

The monorepo contains:

- `apps/extension`: Chrome/Edge MV3 side panel, service worker and marketplace content script;
- `apps/web`: Next.js landing/search UI and versioned API routes;
- `packages/domain`: runtime-validated shared schemas;
- `packages/extraction`: marketplace detection, canonicalization, sanitization and extractors;
- `packages/groq`: constrained AI interpretation and natural-language intent parsing;
- `packages/valuation`: deterministic comparable selection, weighting and confidence gating;
- `packages/data-access`: repository contract with atomic local JSON and DynamoDB implementations;
- `data/source`: the supplied source CSV;
- `scripts`: migration, validation and clean packaging;
- `infra`: AWS CloudFormation POC resources.

## Local prerequisites

- Node.js 22+
- pnpm 10 (`corepack enable` is sufficient on standard Node installs)
- Chrome or Edge 114+

From `C:\Users\salma\Hackathon`:

```powershell
corepack enable
pnpm install
pnpm migrate:data
pnpm validate:data
pnpm test
pnpm typecheck
pnpm build
```

Start the local backend/web experience:

```powershell
Copy-Item .env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`. The app works without Groq: interpretation and search intent parsing use conservative deterministic fallbacks.

### Optional Groq configuration

Never paste a key into source, chat, a command argument, or a committed file. On your own machine, open `apps/web/.env.local` in a text editor and enter:

```dotenv
GROQ_API_KEY=your_key_entered_locally
```

`.env.local` is ignored by Git. The extension contains no key and calls only the MotoMoto backend. If a key has ever been exposed in chat or committed history, revoke it at the provider and create a replacement before use.

## Build and load the extension

The default build permits only the supported marketplaces plus `http://localhost:3000/*`.

```powershell
pnpm build:extension
```

Then:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select `C:\Users\salma\Hackathon\apps\extension\dist`.
5. Open an individual Carousell or SGBikeMart motorcycle listing.
6. Click MotoMoto.ai to open the side panel.

For a deployed backend, rebuild with its exact origin. This changes only the backend host permission—never use `<all_urls>`.

```powershell
$env:MOTOMOTO_BACKEND_ORIGIN='https://example.lambda-url.us-east-1.on.aws'
pnpm build:extension
```

## Agentic AI workflow

The POC uses bounded, auditable orchestration rather than giving an LLM control of storage or pricing:

1. The extension detects whether the active page is supported.
2. A user click starts deterministic extraction from structured data, semantic labels, metadata and narrowly selected description content.
3. Contact information is removed before the description reaches the backend.
4. The interpretation route asks Groq only for explicitly evidenced maintenance, accident, modification, price-semantic and red-flag facts. Its JSON is schema-validated.
5. Deterministic evidence remains stronger than AI evidence and every field retains source/confidence/snippet metadata.
6. The user reviews material fields and confirms the meaning of the displayed price.
7. Only the analyse click authorizes validation, deduplication, persistence, comparable retrieval and valuation.
8. The deterministic engine computes the output; the LLM never supplies a number.

No hidden chain of thought is exposed or persisted. The stored trace consists only of concise action/outcome audit events.

## Data and valuation policy

The migration decodes the supplied CSV as Windows-1252, preserves known values and nulls, normalizes dates/statuses, canonicalizes valid URLs, reports invalid URLs and removes only exact duplicate source identities. It creates one migrated listing record per unique source plus migration metadata.

Because the source spreadsheet does not establish whether its amount is a full cash price, downpayment or monthly instalment, every migrated amount is `UNKNOWN`. Those records may support only an explicitly low-confidence indication with an 0.18 reliability multiplier. They cannot contribute to authoritative price statistics. New records must be `FULL_PRICE` or `TOTAL_INSTALLMENT_PRICE` to be authoritative.

The comparable engine uses stable-listing identity, model/brand/class/capacity similarity, COE/age/mileage/condition similarity, source reliability and a 120-day freshness half-life. It returns weighted 25th/50th/75th percentiles. Fewer than two authoritative comparables caps confidence at low; no eligible evidence returns insufficient with no fabricated estimate.

`SOLD` means only that an advertised listing later appeared sold. It is not a transaction price.

## API

### `POST /api/v1/interpret`

Accepts `{ "draft": ExtractedDraft }`. Returns a merged suggestion, provenance, material conflicts, missing critical fields and a short action/outcome trace. It performs no repository call.

### `POST /api/v1/analyse`

Accepts `{ "reviewedDraft": ListingDraft, "aiEvidence": [], "userOverrides": [] }`. It validates, finds exact/possible duplicates, writes the stable listing and observation, then calculates a valuation. Successful ingestion is retained even if comparable evidence is insufficient.

### `GET /api/v1/search?q=...`

Parses hard filters separately from soft preferences and searches only `AVAILABLE`/`RESERVED` current listings. Groq parsing is optional; a deterministic parser handles class, brand, budget, mileage/COE preference and broad usage intent.

## AWS hackathon deployment

Preferred low-cost POC resources are a Lambda container behind a Function URL, one DynamoDB on-demand table, ECR and CloudWatch Logs. No NAT Gateway, RDS, EC2, OpenSearch or SSM Parameter Store is required. The project keeps working locally if organization policies block any AWS step.

The CloudFormation template creates the Lambda, least-purpose execution role, Function URL and on-demand table. Build/push the image using the hackathon guide and deploy:

```powershell
aws cloudformation deploy `
  --stack-name motomoto-v2 `
  --template-file infra/template.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --parameter-overrides ImageUri=ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/motomoto-v2:TAG
```

Do not put temporary AWS credentials in `.env.local`, source files, Git, screenshots, shell scripts or deployment parameters. Configure the AWS CLI through the hackathon login flow; session credentials expire and are needed only by the person deploying, not by an already-running Lambda.

SSM Parameter Store is intentionally absent. After deployment, enter `GROQ_API_KEY` yourself using the Lambda console’s encrypted environment-variable configuration (or an approved deployment-platform secret UI). Never send the value to the browser extension. The key does not expire with AWS session credentials; rotate it independently if revoked or exposed.

After obtaining the Function URL, rebuild the extension with that exact `MOTOMOTO_BACKEND_ORIGIN` and reload the unpacked extension. Review AWS Billing/Cost Explorer and delete the stack/ECR images after the event if no longer needed.

## Tests and verification

`pnpm test` covers sanitizer/canonical URL behavior, SGBikeMart deterministic extraction, stable-listing deduplication, append-only observations, robust valuation, low-confidence legacy gating and no-comparable behavior. `pnpm typecheck` checks every workspace package; `pnpm build` builds the extension and production Next.js app.

Manual browser checks should cover:

- landing page at desktop and narrow viewport;
- natural-language search with and without results;
- extension unsupported state;
- extraction/review/clarification/progress/result states;
- one current individual listing on each supported marketplace when publicly accessible;
- no write after interpretation and exactly one observation after analysis;
- extension bundle secret scan.

## 2–3 minute judge demo

1. **0:00–0:20 — Problem.** Explain that Singapore used-bike ads mix full prices, deposits and instalments, while condition and COE evidence is inconsistent.
2. **0:20–0:35 — Product.** Show the landing page and explain the Browse → Analyse → Compare → Negotiate informed loop.
3. **0:35–1:15 — Extension.** Open a supported listing, launch the side panel and press **Extract listing**. Point out deterministic field count, provenance and the explicit full-price clarification.
4. **1:15–1:50 — Agentic boundary.** Explain that Groq interprets only sanitized evidence, cannot write, and never calculates price. Confirm the reviewed price meaning and press **Analyse this bike**.
5. **1:50–2:20 — Trust.** Show independent comparable count, range, confidence and limitation reason codes. If evidence is insufficient, emphasize that refusal is an intentional safety outcome.
6. **2:20–2:45 — Flywheel.** Explain stable listing identity and append-only observations: every authorized analysis improves future evidence without duplicate inflation.
7. **2:45–3:00 — Search/AWS.** Search in natural language, then show the serverless Lambda + DynamoDB architecture and no-secret extension.

## Submission and security

Create a clean archive (excluding Git metadata, dependencies, build caches, secrets and runtime data):

```powershell
pnpm clean:submission
```

See [SECURITY.md](SECURITY.md) for handling and incident guidance. MotoMoto estimates advertised asking-price evidence only and does not replace inspection, financing verification, legal checks or professional advice.
