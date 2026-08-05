# Proofly

Proofly is an AI-powered GitHub portfolio intelligence platform for people pursuing careers in technology.

The first MVP slice retrieves public GitHub repositories for a username, asks the user for a target career path, ranks repositories using deterministic metadata, and can run a deeper deterministic repository evidence analysis with a 1-10 rating. AI explanation will be added in a later slice after the evidence package is mature.

## Development

```bash
npm install
npm run build
npm run dev
```

The web app runs on `http://localhost:5173` and the API runs on `http://localhost:4000`.

## Environment

Copy the API example environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

`GITHUB_TOKEN` is optional for local development, but recommended to avoid unauthenticated GitHub rate limits.
