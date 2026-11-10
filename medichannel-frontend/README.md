# MediChannel Frontend

MediChannel is a Next.js 16 application. The full interactive prototype is served from `public/mediclinic-system.html`; the other routes provide the Next.js application pages and API proxy.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `API_URL` in `.env.local` to the backend API origin before using backend-backed authentication and API routes. Do not commit `.env.local` or production credentials.

## Verify a production build

```bash
npm run lint
npm run build
npm start
```

## Deploy to Netlify

The repository-root `netlify.toml` builds this app from the `medichannel-frontend` subdirectory using Netlify's Next.js integration. Import the repository into Netlify and keep the detected build settings from that file.

After deploying the backend to Render, add `API_URL` to the Netlify site's environment variables. Set it to the Render service origin (for example, `https://medichannel-api.onrender.com`) without a trailing slash or `/api` path, and enable the **Functions** scope. Trigger a new deploy after setting the variable. The browser calls this frontend's same-origin API routes, which proxy requests to `API_URL`; do not expose backend or database credentials through `NEXT_PUBLIC_*` variables.

For the full Netlify, Render, and Neon setup sequence, see the repository [deployment guide](../README.md#deployment).
