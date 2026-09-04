# Secret handling

## Groq API key

- Local development: store `GROQ_API_KEY` only in `.env.local`. Next.js loads this file automatically; `python-dotenv` is not used.
- AWS deployment: configure `GROQ_API_KEY` as an AWS Lambda runtime environment variable. Lambda encrypts environment variables at rest with its AWS-managed KMS key.
- Never prefix the key with `NEXT_PUBLIC_`; that would expose it to browser code.
- Never place the key in Docker build arguments, Dockerfiles, deployment manifests, shell scripts, source files, logs, or GitHub settings that are not designated secrets.
- Never write the key into `.env.production` during a build or include it in a deployment artifact.
- Rotate and revoke the key immediately if it is pasted into chat, committed, logged, or otherwise exposed.

## AWS credentials

- Use the temporary `ignite` AWS CLI profile from the hackathon access portal.
- Do not place AWS access keys in `.env.local`, Lambda configuration, source code, or Git.
- The temporary credentials expire every 12 hours and should only be used for deployment operations.

## Repository controls

The repository ignores `.env`, `.env.local`, and other `.env*` files through `.gitignore` and `.dockerignore`. Before pushing, confirm that `git status` does not show a secret file and run a secret scan if one is available.
