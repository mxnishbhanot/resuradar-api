# Playwright image with all browsers + deps already installed
FROM mcr.microsoft.com/playwright:focal:latest

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else
COPY . .

# Expose the port your Node server listens on
EXPOSE 10000

# Start your app
CMD ["npm", "start"]
