# Correct Playwright base image with all deps + Chromium installed
FROM mcr.microsoft.com/playwright:v1.48.2-focal

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy your app code
COPY . .

# Expose your app port
EXPOSE 10000

# Start your server
CMD ["npm", "start"]
