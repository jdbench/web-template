FROM node:24-alpine AS frontend-dependencies

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM frontend-dependencies AS builder

COPY frontend/ frontend/
COPY handlers/ handlers/
COPY scripts/ scripts/
COPY tests/ tests/
COPY tsconfig.json eslint.config.js playwright.config.ts vitest.config.ts ./
RUN npm run build \
	&& mkdir -p /runtime-frontend/dist \
	&& cp dist/app.min.js dist/app.min.css /runtime-frontend/dist/

WORKDIR /build/frontend
RUN find . -type f -name '*.html' -exec sh -c 'mkdir -p "/runtime-frontend/$(dirname "$1")"; cp "$1" "/runtime-frontend/$1"' _ {} \;

FROM frontend-dependencies AS development

COPY scripts/dev.ts scripts/dev.ts
CMD ["npm", "run", "watch"]

FROM frontend-dependencies AS quality-tools

RUN apk add --no-cache git=2.54.0-r0 \
	&& git config --system --add safe.directory /workspace \
	&& ln -s /build/node_modules /node_modules

FROM alpine:3.22 AS lambda-package

RUN apk add --no-cache zip=3.0-r13
WORKDIR /package
COPY --from=builder /build/dist/handlers/ /package/handlers/
COPY --from=builder /runtime-frontend/ /package/frontend/
RUN zip -qr /lambda.zip .

FROM scratch AS lambda-artifact

COPY --from=lambda-package /lambda.zip /lambda.zip

FROM public.ecr.aws/lambda/nodejs:24

RUN dnf upgrade -y \
	&& dnf clean all

COPY --from=builder /build/dist/handlers/ ${LAMBDA_TASK_ROOT}/handlers/
COPY --from=builder /runtime-frontend/ ${LAMBDA_TASK_ROOT}/frontend/

CMD ["handlers/index.handler"]