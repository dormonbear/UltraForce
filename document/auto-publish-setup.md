# Automated Publishing Setup Guide

This guide explains how to set up and use the automated CI/CD pipeline for UltraForce.

## Architecture Overview

```
Developer                GitHub Actions              Chrome Web Store
   |                          |                           |
   |-- git push develop ----->|                           |
   |                    [CI: lint, test, build]           |
   |                          |                           |
   |-- git push v* tag ------>|                           |
   |                    [Release workflow]                |
   |                    [1. lint + test]                  |
   |                    [2. build + package]              |
   |                    [3. GitHub Release] ----------->  |
   |                    [4. CWS upload (optional)] ----> [Review & Publish]
   |                          |                           |
```

## CI Pipeline (`.github/workflows/ci.yml`)

Triggers on every push to `develop`/`main` and on pull requests.

**Jobs:**
- **lint-and-typecheck**: Runs ESLint and TypeScript compiler
- **unit-test**: Runs Vitest with coverage report
- **build**: Builds and packages the extension (runs after lint + tests pass)

No configuration needed -- works out of the box.

## Release Pipeline (`.github/workflows/release.yml`)

Triggers when a `v*` tag is pushed (e.g., `v0.2.0`).

### Quick Release Flow

```bash
# 1. Bump version (creates commit + tag)
pnpm release:patch    # or release:minor, release:major

# 2. Edit the release notes placeholder
#    Open docs/guide/release-notes.md and fill in actual notes

# 3. Amend the commit with your edits
git add docs/guide/release-notes.md
git commit --amend --no-edit

# 4. Push to trigger the release
git push origin develop --tags
```

### What the Release Workflow Does

1. Checks out the tagged commit
2. Runs lint, type-check, and unit tests
3. Builds the extension with `plasmo build`
4. Packages with `plasmo package` (produces `.zip`)
5. Extracts release notes from `docs/guide/release-notes.md`
6. Creates a GitHub Release with the `.zip` attached
7. If Chrome Web Store publishing is enabled, uploads and publishes

## Chrome Web Store Auto-Publish (Optional)

CWS publishing is **disabled by default**. To enable it:

### Step 1: Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project (e.g., `ultraforce`)
3. Enable the **Chrome Web Store API**
4. Go to **IAM & Admin** > **Service Accounts** > **Create Service Account**
5. Download the JSON key file

### Step 2: Grant CWS Access

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Navigate to **Settings** > **Group publishers** (or invite the service account email as a group member)
3. Add the service account email (e.g., `<your-service-account>@<your-project>.iam.gserviceaccount.com`) with publish permissions

### Step 3: Configure GitHub Repository

Go to **GitHub repo** > **Settings** > **Secrets and variables** > **Actions**:

**Secrets** (sensitive values, encrypted):

| Secret | Value |
|--------|-------|
| `CWS_SERVICE_ACCOUNT_KEY` | Paste the **entire JSON content** of the service account key file |

**Variables** (non-sensitive config):

| Variable | Value |
|----------|-------|
| `CWS_EXTENSION_ID` | `maemkmihjmlfilhpfeeindecjnagelkh` |
| `CWS_PUBLISH_ENABLED` | `true` |

### Step 4: Verify

Push a tag and check the Actions tab. The release workflow should show the CWS upload and publish steps.

> **Note:** Chrome Web Store reviews typically take 1-3 business days. The extension will be updated for users after Google approves the submission.
> **Security:** Never commit the service account JSON key file to the repository. Store it only as a GitHub secret.

## Version Bump Scripts

| Command | Effect | Example |
|---------|--------|---------|
| `pnpm release:patch` | Bump patch version | 0.1.1 -> 0.1.2 |
| `pnpm release:minor` | Bump minor version | 0.1.1 -> 0.2.0 |
| `pnpm release:major` | Bump major version | 0.1.1 -> 1.0.0 |

Each command:
1. Updates `version` in `package.json`
2. Adds a placeholder section to `docs/guide/release-notes.md`
3. Creates a git commit (`release: vX.Y.Z`)
4. Creates a git tag (`vX.Y.Z`)

Add `--no-tag` to skip the git commit and tag (useful for preview).

## Troubleshooting

### CI fails on `pnpm install --frozen-lockfile`

The lockfile is out of sync. Run `pnpm install` locally and commit the updated `pnpm-lock.yaml`.

### Release workflow skips CWS upload

Check that the repository variable `CWS_PUBLISH_ENABLED` is set to exactly `true`. Also verify all three secrets (`CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`) are configured.

### CWS upload fails with 401

The refresh token has expired. Re-run `npx chrome-webstore-upload-cli@3 init` to get a new token and update the `CWS_REFRESH_TOKEN` secret.

### Build succeeds but no `.zip` found

Ensure `plasmo package` is running correctly. Check the `build/` directory for the output. Plasmo places the zip in `build/chrome-mv3-prod/` by default.
