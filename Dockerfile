FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/valuation/package.json packages/valuation/package.json
COPY packages/data-access/package.json packages/data-access/package.json
COPY packages/groq/package.json packages/groq/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages packages
COPY data data
RUN pnpm build:web

FROM node:22-alpine AS runtime
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV NODE_ENV=production PORT=8080 AWS_LWA_PORT=8080
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/data ./data
CMD ["node", "apps/web/server.js"]
