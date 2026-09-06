# MotoMoto.ai security

## Secrets

- Put `GROQ_API_KEY` only in `apps/web/.env.local` for local development or in the Lambda runtime environment for AWS.
- Never prefix it with `NEXT_PUBLIC_` or `VITE_`.
- Never put AWS credentials, Groq credentials, or database credentials in the extension.
- Temporary hackathon AWS credentials belong only in a named local AWS CLI profile.
- SSM Parameter Store is not used because it is blocked by the hackathon account.
- Rotate any credential that has appeared in chat, logs, screenshots, or Git.

## Extension

- Extraction is initiated by the user on the active tab.
- Host permissions are limited to Carousell, SGBikeMart, localhost development, and the configured MotoMoto backend.
- The extension sends structured fields and sanitized description text, never raw HTML.
- Seller names, usernames, phone numbers, email addresses, and unrelated contact text are removed where practical.

## Backend

- Every payload is schema validated and size limited.
- The backend never fetches arbitrary URLs supplied by the extension.
- Groq receives only bounded, sanitized motorcycle-listing text.
- Public Lambda Function URLs are temporary demo infrastructure. CORS is not authentication.
- Delete or disable public demo resources after judging.
