# Official image already includes Chromium + OS deps for Playwright.
# Keep the tag in sync with the resolved `playwright` version in package-lock.json
# (https://playwright.dev/docs/docker#image-tags).
FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

# Browsers are baked into the base image; avoid re-downloading during npm install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
# `npm ci` fails on Linux (Render) when the lock omits optional-peer subtrees
# (e.g. mongodb → optional gcp-metadata → gaxios@5) that Windows-generated locks can skip.
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 10000

CMD ["npm", "start"]
