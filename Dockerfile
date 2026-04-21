# Official image already includes Chromium + OS deps for Playwright.
# Keep the tag in sync with the resolved `playwright` version in package-lock.json
# (https://playwright.dev/docs/docker#image-tags).
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Browsers are baked into the base image; avoid re-downloading during npm install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 10000

CMD ["npm", "start"]
