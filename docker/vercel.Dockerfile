# Vercel-side preview. Pinned to the Node version Vercel's builders default to,
# so a build that only fails on their runtime fails here too.
FROM node:22-alpine

RUN corepack enable && npm install -g vercel@latest

WORKDIR /site

EXPOSE 3000

# `vercel dev` reads vercel.json and reproduces routing, headers and clean URLs.
# --listen 0.0.0.0 is required for the port to be reachable from the host.
CMD ["sh", "-lc", "pnpm install --frozen-lockfile=false && vercel dev --listen 0.0.0.0:3000 --yes"]
