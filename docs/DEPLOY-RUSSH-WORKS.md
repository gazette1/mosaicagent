# Deploying the intake page to russh.works

Current state: russh.works returns NXDOMAIN (checked 2026-07-25). The domain
is either unregistered or has no nameservers. Nothing can be served on it
until that is fixed. Steps below take about 10 minutes once you have the
domain.

## 1. Domain

Register russh.works at any registrar (Cloudflare Registrar or Namecheap are
fine) if not already owned. If owned, log in to the registrar and confirm
nameservers are set.

## 2. Host the backend (Render, free tier)

The intake page is not static: it runs the pipeline (Node server driving the
CLI plus the OpenAI key), so it needs a host.

1. Sign in at render.com with the gazette1 GitHub account.
2. New > Blueprint > select the `gazette1/mosaicagent` repo. Render reads
   `render.yaml` and creates the `mosaic-intake` web service.
3. Set the two environment variables when prompted:
   - `OPENAI_API_KEY`: the OpenAI key (use the ROTATED one, not the original)
   - `DEMO_PASSCODE`: any shared passcode; the public page requires it before
     it will spend tokens. Without this variable the API is open to anyone.
4. Deploy. You get `https://mosaic-intake.onrender.com` (or similar). Verify
   the page loads and a test run works with the passcode.

Free-tier note: Render free services sleep after idle; first hit takes ~30s
to wake. Fine for a demo. Upgrade to Starter if that annoys.

## 3. Point the domain

In Render: mosaic-intake > Settings > Custom Domains > add `russh.works` and
`www.russh.works`. Render shows the exact records. At the registrar's DNS:

| Host | Type | Value |
|---|---|---|
| `www` | CNAME | `mosaic-intake.onrender.com` |
| `@` (apex) | A or ALIAS/ANAME | the IP or target Render displays |

TLS is automatic once DNS propagates (minutes to an hour).

## 4. Alternative: instant tunnel from this machine (no accounts)

For a same-day demo without registering anything:

```bash
npx cloudflared tunnel --url http://localhost:8787
```

This prints a random `https://<words>.trycloudflare.com` URL that proxies to
the locally running server. No russh.works, but shareable in 30 seconds while
the machine is on. Set `DEMO_PASSCODE` in `.env` first if sharing beyond the
team.

## Security notes

- Never commit `.env`. The repo ignores it; keep it that way.
- Rotate the OpenAI key that was pasted in chat before using it on a public
  host.
- `DEMO_PASSCODE` is a demo gate, not real auth. Before Michael's live deals
  touch a hosted version, add real auth and HTTPS-only cookies, and move deal
  storage off the service's ephemeral disk.
