# Relay serverless template

A server-rendered TypeScript application template targeting the Node.js 24 Lambda runtime. Floci provides the local AWS control plane and executes the compiled Lambda application.

## Architecture

- `frontend/` contains private HTML templates and browser CSS/TypeScript sources.
- `handlers/web/render.ts` composes and minifies HTML on the server.
- The Docker builder type-checks and lints the application, bundles the Lambda TypeScript, and produces minified `app.min.css` and `app.min.js` browser artifacts.
- `handlers/index.ts` serves rendered pages, generated browser bundles, health, contact, and authentication routes.
- DynamoDB stores scrypt password hashes and SHA-256 session-token hashes. Plaintext passwords are never stored.
- nginx provides one local origin and proxies every request to the Floci Lambda Function URL.

## Local development

Docker with Compose is the only prerequisite. The command works on Windows, macOS, and Linux.

```sh
docker compose up --build
```

Open `http://localhost:8080`. Compose starts Floci, builds the Lambda image, provisions DynamoDB and the Lambda Function URL, and starts the same-origin proxy.

Local authentication uses HTTP only because Compose explicitly sets `ALLOW_INSECURE_AUTH=true`. This exception is for local development and must never be configured in production.

For an attached development session with Floci native Lambda hot reload, run:

```sh
npm run dev
```

The command builds the watcher in Docker, compiles handlers, templates, and browser bundles into a Docker volume, provisions a Node.js 24 hot-reload function, and tails all Compose logs in the terminal. Changes under `handlers/` or `frontend/` are compiled automatically and used by the next Lambda invocation without redeployment. Press `Ctrl+C` to stop the attached session.

## Code quality

TypeScript uses strict checking. ESLint uses the type-aware `typescript-eslint` preset, with `eslint-config-prettier` disabling rules that conflict with Prettier. Vitest unit tests cover frontend and Lambda modules with enforced coverage thresholds. `npm audit` blocks High and Critical project dependency vulnerabilities. All tools run in Docker during the application build.

```sh
docker build --target builder .
```

Run the unit suite directly in the Docker quality environment:

```sh
docker build --target quality-tools -t relay-quality-tools .
docker run --rm -v "$PWD:/workspace" -w /workspace relay-quality-tools npm run test
```

VS Code formats supported files on save with the recommended Prettier extension. Husky and lint-staged format and lint only staged files before each commit. The hook itself runs the tools in Docker, so it does not require host Node.js. Running `npm install` installs the hook automatically; for a Docker-only checkout, run this once:

```sh
docker build --target quality-tools -t relay-quality-tools .
docker run --rm -v "$PWD:/workspace" -w /workspace relay-quality-tools /build/node_modules/.bin/husky
```

Stop the stack without deleting persisted resources:

```sh
docker compose stop
```

Delete the stack and persisted state:

```sh
docker compose down --volumes
```

## Authentication transport

Production authentication requests are rejected unless Lambda reports HTTPS through `X-Forwarded-Proto`. Lambda Function URLs provide HTTPS directly, so API Gateway is not required.

Browser developer tools show a password before the browser encrypts its HTTPS request. This does not mean the password is visible on the network. Client-side hashing or encryption does not solve this problem because the resulting value becomes a reusable password equivalent and any browser-side encryption key is visible to the user.

To avoid transmitting passwords entirely, replace password authentication with WebAuthn/passkeys or a vetted PAKE implementation such as OPAQUE. Do not implement a custom challenge-response protocol.

## Production

Build a ZIP artifact entirely in Docker:

```sh
docker build --target lambda-artifact --output type=local,dest=dist/lambda .
```

The output is `dist/lambda/lambda.zip`. Create or update a Node.js 24 Lambda with handler `handlers/index.handler`, then upload that ZIP. Configure `AUTH_TABLE_NAME`, `SESSION_DURATION_SECONDS`, and the DynamoDB permissions; never set `ALLOW_INSECURE_AUTH` in production. Create an HTTPS Lambda Function URL for the function and configure its resource policy for the intended access level. The Function URL serves the HTML, assets, and API from one origin without API Gateway.

The included GitHub Actions workflow publishes the container image to `ghcr.io/<owner>/<repository>`. This is useful for compatible container hosts and for retaining versioned images. AWS Lambda cannot pull container images from GHCR; Lambda image deployments accept Amazon ECR only. The ZIP path above avoids both ECR and API Gateway.

### GitHub deployment

The `Deploy Lambda` workflow runs on pushes to `main` and can also be started manually. Configure the `production` GitHub environment with these secrets:

| Secret                      | Purpose                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`       | AWS IAM role trusted by GitHub OIDC and allowed to manage this Lambda, its Function URL policy, and the DynamoDB table.   |
| `LAMBDA_EXECUTION_ROLE_ARN` | Runtime IAM role assumed by Lambda. It needs CloudWatch Logs permissions and DynamoDB access to the authentication table. |

Add these repository or `production` environment variables:

| Variable                   | Example                                        |
| -------------------------- | ---------------------------------------------- |
| `AWS_REGION`               | `us-east-1`                                    |
| `LAMBDA_FUNCTION_NAME`     | `relay-production`                             |
| `AUTH_TABLE_NAME`          | `relay-auth`                                   |
| `SESSION_DURATION_SECONDS` | `86400`                                        |
| `ALLOWED_ORIGIN`           | The final Function URL or custom HTTPS origin. |

The workflow uses short-lived GitHub OIDC credentials, so do not add AWS access-key or secret-key credentials to GitHub. It provisions the DynamoDB table on first deployment, updates the ZIP-based Node.js 24 Lambda, and creates a direct public Function URL. Public URLs are appropriate only when the application itself owns access control, as this template does for authenticated routes.

Restrict cross-origin access and add application-level throttling for registration and login. AWS services, Lambda invocations, DynamoDB usage, and outbound data can still incur charges even without ECR or API Gateway.

The contact route currently validates and acknowledges requests. Replace it with SES, SQS, DynamoDB, or another AWS integration for production use.

## Pull request protection

The pull request workflows run the real Floci integration environment, lint the Dockerfile, and scan the deployable Lambda image. Configure a GitHub ruleset for the `main` branch under **Settings > Rules > Rulesets** with:

- Require a pull request before merging and at least one approval.
- Dismiss stale approvals when new commits are pushed.
- Require branches to be up to date before merging.
- Require these status checks: `Unit Tests`, `Playwright E2E`, `Dockerfile Lint`, and `Container Security Scan`.
- Block force pushes and branch deletion.
- Do not add bypass actors unless an emergency process requires them.

Workflow files alone do not block merging; the repository ruleset makes those checks mandatory. Dependabot PRs are not auto-approved or auto-merged, so they require the same checks and human approval as every other PR.

Trivy blocks fixed High and Critical operating-system vulnerabilities in the final image. Project JavaScript dependencies are covered by the blocking `npm audit` in the Docker build. AWS base-image findings that cannot yet be updated from Amazon Linux repositories are listed individually in `.trivyignore.yaml` with expiration dates; CI fails when an exception expires, forcing review against a refreshed AWS base image.
