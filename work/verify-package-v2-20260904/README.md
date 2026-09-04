# ThrottleWorth

ThrottleWorth is an immediately usable Singapore used-motorcycle discovery and comparable-market valuation MVP. Riders can describe a bike in natural language, combine that request with explicit filters, compare real seller listings, and see the evidence behind each estimated asking-value range.

The included local data file contains 84 unique rows imported from `SG_Motorcycle_Model_Master_2010plus (1).xlsx`. No production listings are synthetic. Missing mileage, COE, ownership, and condition values remain unknown.

## Architecture

- Next.js App Router, TypeScript, React, and Tailwind CSS
- Groq for structured query interpretation and optional short explanations
- Deterministic TypeScript logic for comparable search, valuation, confidence, price assessment, and Deal Score
- A checked-in real-data JSON dataset for the write-free hackathon workload
- AWS Lambda, Lambda Function URLs, ECR, optional S3, and CloudWatch for deployment

The hackathon deployment reads `src/data/motorcycles.json` directly. This avoids an always-on database, keeps the demo deterministic, and preserves the existing PostgreSQL adapter as an optional post-hackathon path.

## Local setup

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Create `.env.local` from `.env.example` and place the Groq key there. Open `http://localhost:3000`. A Groq key is optional for local use; deterministic parsing and all manual filters continue to work without it. Next.js loads `.env.local` itself, so `python-dotenv` is not required.

Quality checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Natural-language search | Server-only Groq authentication |
| `AWS_REGION` | AWS deployment | Required hackathon value: `us-east-1` |
| `MOTORCYCLE_DATA_BUCKET` | Optional | S3 bucket for original workbook snapshots and future model artifacts |
| `MOTORCYCLE_DATA_PATH` | Optional | Local JSON import output; defaults to `src/data/motorcycles.json` |

For local development, put `GROQ_API_KEY` in `.env.local`. For AWS, configure it only as a Lambda runtime environment variable. Never use a `NEXT_PUBLIC_` prefix, include the key in Docker build arguments, write it into `.env.production`, or commit it to Git. AWS credentials are deployment credentials and must not be placed in the application environment.

## Excel import

The importer locates listing sheets by their headers rather than sheet name. It normalizes `NA`, blanks, dates, numbers, percentages, and duplicate URLs, rejects rows without a usable URL/price/class/model, computes condition only from available evidence, and produces stable IDs.

```bash
pnpm import:motorcycles -- "./data/SG_Motorcycle_Model_Master_2010plus.xlsx"
```

With no `DATABASE_URL`, the command refreshes the local JSON data. With `DATABASE_URL`, it also upserts those same verified rows into PostgreSQL and prints an import summary.

## Optional post-hackathon PostgreSQL setup

The production hackathon demo does not require PostgreSQL. If a later deployment needs mutable listing data, create a PostgreSQL database, set `DATABASE_URL`, then run:

```bash
pnpm db:migrate
pnpm import:motorcycles -- "./data/SG_Motorcycle_Model_Master_2010plus.xlsx"
```

The migration creates `motorcycle_listings`, search indexes, and a data-version-aware `valuation_cache` table for future persistent caching. The current server uses a small process cache keyed by listing ID and dataset version.

## Search and Groq

`POST /api/search` sends a natural-language query to Groq using strict JSON output and validates the response with Zod. Explicit UI filters override interpreted fields. If Groq is unavailable or returns invalid JSON, the route uses a conservative deterministic parser; it never invents listings or asks an LLM to perform valuation arithmetic.

Endpoints:

- `POST /api/search`
- `GET /api/bikes/:id`
- `GET /api/bikes/:id/valuation`
- `GET /api/bikes/:id/comparables`

## Comparable search

The engine excludes the target listing and begins with brand, model, class, CC, COE, age, mileage, and condition. It progressively relaxes criteria through eight configurable levels, stopping once enough evidence exists. Asking price is deliberately absent from the comparable group ID.

Similarity weights favor exact model, COE, class, and CC, followed by age, mileage, condition, and brand. Missing values receive a neutral-low contribution rather than an excellent score.

## Valuation and confidence

The valuation engine:

1. Finds and similarity-ranks comparables.
2. Removes invalid prices and filters obvious IQR outliers.
3. Calculates median, weighted mean, lower quartile, and upper quartile.
4. Uses a median-led robust midpoint and rounds display estimates to S$50.
5. Compares the seller's asking price only after estimating the comparable-market range.

Confidence considers comparable count, fallback level, average similarity, missing mileage/COE/age, and evidence completeness. Thresholds and all price/deal weights live in `src/lib/config/valuation.ts`.

These are estimated market asking values, not confirmed transaction prices, guarantees, or statements of actual sale value.

## AWS hackathon deployment

The deployment target is a Lambda container image exposed through a Lambda Function URL. `Dockerfile.lambda` packages the Next.js standalone server with the AWS Lambda Web Adapter. This keeps compute pay-per-use and requires no API Gateway, load balancer, NAT Gateway, RDS instance, App Runner service, or SSM Parameter Store.

AWS resources:

- One private ECR repository for the application image
- One Lambda function with a Function URL
- The Lambda-created CloudWatch log group
- Optionally one private, encrypted S3 bucket for the original workbook snapshot

Use `us-east-1` for every resource. The application uses the embedded 84-row real dataset at runtime, so `DATABASE_URL` must remain unset for the hackathon deployment.

### 1. Authenticate safely

Load the temporary hackathon credentials into a named AWS CLI profile called `ignite`. Never add AWS credentials to `.env.local` or the Lambda environment.

```powershell
aws sts get-caller-identity --profile ignite --region us-east-1
```

### 2. Build and push the Lambda image

Create an ECR repository named `motomoto-ai`, authenticate Docker to the repository, then build `Dockerfile.lambda` and push its `latest` tag. The Lambda Web Adapter image is pinned to version `1.0.1`.

```powershell
docker build -f Dockerfile.lambda -t motomoto-ai:latest .
```

The exact ECR login and tag commands depend on the leased AWS account ID; retrieve it with `aws sts get-caller-identity` rather than placing an account ID in source control.

### 3. Create the Lambda function

Create a container-image Lambda function named `motomoto-ai` using the ECR image. Recommended demo settings:

- Architecture: `x86_64`
- Memory: 1,024 MB
- Timeout: 30 seconds
- Reserved concurrency: leave unset
- Function URL authentication: `NONE` for the public demo
- Region: `us-east-1`

Use a minimal execution role with `AWSLambdaBasicExecutionRole`; no VPC access is required. Lambda sends stdout and stderr to CloudWatch automatically.

### 4. Configure the Groq key

In the Lambda console, open **Configuration > Environment variables** and add:

```text
GROQ_API_KEY=<rotated key>
```

Use Lambda's platform configuration rather than source files, Docker build arguments, deployment manifests, SSM Parameter Store, or GitHub. Lambda encrypts runtime environment variables at rest with an AWS-managed KMS key by default. Do not place the key in a CLI command because shell history and process listings can expose it.

After changing the key, publish the configuration and run one natural-language search through the Function URL. If Groq is unavailable, manual filters and deterministic fallback parsing continue to work.

### 5. Optional S3 source archive

If desired for the architecture demonstration, create a private bucket with Block Public Access and default encryption enabled, then upload the original workbook. The running application does not need permission to read this bucket; it is provenance/archive storage only.

### Cost controls

- Keep only one Lambda function and one ECR image tag.
- Do not enable provisioned concurrency.
- Do not create RDS, EC2, App Runner, NAT Gateways, load balancers, OpenSearch, or SageMaker endpoints.
- Do not add a customer-managed KMS key; the Lambda-managed key avoids an extra KMS resource and charge.
- Monitor the hackathon budget indicator because account access is revoked at the event's effective limit.
- Remove the Lambda function, ECR images, and optional S3 bucket after judging if the sandbox is not automatically reclaimed.

## Known limitations and roadmap

- Source data contains asking prices, not completed transactions.
- Some motorcycles have sparse mileage, COE, or condition evidence; the UI surfaces this as lower confidence.
- Small model-level samples can require broad comparable fallback.
- No live scraping, accounts, alerts, or production admin tools are included.
- A future `predictMLValue(listing)` adapter can add CatBoost, LightGBM, or XGBoost as a second signal. Model artifacts should live in S3, but comparable evidence should remain visible and independently auditable.
