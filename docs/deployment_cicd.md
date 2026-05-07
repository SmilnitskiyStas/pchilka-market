# Deployment

## Manual sync deployment

For the current stage, full automatic CI/CD is not required. Use a manual command from the local machine:

```powershell
npm run deploy:sync
```

The command uses:

- `scripts/deploy-sync.ps1`
- `.deploy.local.json`

Create local config first:

```powershell
Copy-Item .deploy.example.json .deploy.local.json
```

Fill `.deploy.local.json` with real server values. This file is ignored by git and must not be committed.

The script does:

1. Runs local `npm run build`, unless `-SkipLocalBuild` is passed directly to the PowerShell script.
2. Creates an archive without `.env*`, `.deploy.local.json`, `.git`, `.github`, `node_modules`, `.next`, `out`.
3. Uploads the archive to the server through `scp`.
4. Extracts it into `appDir`.
5. Runs `npm ci`.
6. Runs `npm run build` on the server if `runBuildOnServer` is `true`.
7. Runs `restartCommand` if configured.

Required local tools:

- `ssh`
- `scp`
- `tar`
- Node.js/npm

Important limitation: this archive sync overwrites changed files but does not delete old files that were removed locally. For most code changes this is acceptable. If deleted files become a problem, switch to `rsync` or git-based deployment.

## GitHub Actions template

There is also a GitHub Actions template, but it is manual-only for now and does not run on every push.

Current workflow file:

- `.github/workflows/deploy.yml`

### Deployment model

The workflow uses GitHub Actions and SSH:

1. GitHub checks out the repository.
2. GitHub installs dependencies with `npm ci`.
3. GitHub runs `npm run build`.
4. If the build passes, GitHub connects to the production server over SSH.
5. On the server it runs:
   - `git fetch --all --prune`
   - `git checkout main`
   - `git pull --ff-only origin main`
   - `npm ci`
   - `npm run build`
   - restart command from GitHub Secrets

### Required GitHub Secrets

Add these in GitHub repository settings:

- `PRODUCTION_HOST` - server IP or domain.
- `PRODUCTION_USER` - SSH user.
- `PRODUCTION_SSH_KEY` - private SSH key allowed to connect to the server.
- `PRODUCTION_SSH_PORT` - SSH port, usually `22`.
- `PRODUCTION_APP_DIR` - absolute path to the app on the server, for example `/var/www/pchilka-web-app`.
- `PRODUCTION_RESTART_COMMAND` - command that restarts the app.

Example restart commands:

- PM2: `pm2 reload pchilka-web-app --update-env`
- systemd: `sudo systemctl restart pchilka-web-app`
- Node script through process manager: use the command already configured on the server.

### One-time server setup

The production server must already have:

- Node.js compatible with the project, currently Node `22` is used in CI.
- Git access to the repository.
- The repository cloned into `PRODUCTION_APP_DIR`.
- Correct `.env.production` or production environment variables.
- A process manager that starts the app with `npm run start` or equivalent.
- SSH public key from `PRODUCTION_SSH_KEY` added to `~/.ssh/authorized_keys` for `PRODUCTION_USER`.

### Important notes

- Do not store `.env.production`, SSH keys, DB passwords, or Telegram tokens in the repository.
- Uploaded runtime files should stay in persistent server storage and must not be deleted during deploy.
- SQL migrations are not automatically applied by this workflow. Apply schema changes explicitly before code that depends on them.
- If the default branch is not `main`, update `.github/workflows/deploy.yml`.
