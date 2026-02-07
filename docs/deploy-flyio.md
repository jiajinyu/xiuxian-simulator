# Fly.io Deployment

## 1. Prerequisites

1. Install `flyctl`: https://fly.io/docs/flyctl/install/
2. Log in locally:

```bash
fly auth login
```

## 2. Create App (first time only)

If `fly.toml` app name is not available, change `app` in `fly.toml` first.

```bash
fly apps create <your-app-name>
```

Then update `fly.toml`:

```toml
app = "<your-app-name>"
```

## 3. Local deploy test

```bash
fly deploy --remote-only --config fly.toml
```

## 4. GitHub Actions CD setup

Set repo secret:

- Name: `FLY_API_TOKEN`
- Value: token created by:

```bash
fly tokens create deploy -x 999999h
```

After this:

- Push to `main` triggers auto deploy.
- You can also run `Deploy to Fly.io` manually from Actions tab.

## 5. Runtime model

- Static files are served by Caddy on port `8080`.
- Root path `/` redirects to `/app/index.html`.
- Unknown paths fallback to `/app/index.html` for SPA routing.
