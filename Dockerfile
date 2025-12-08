# Base Node image
FROM node:20-bookworm

# Install Playwright browsers & dependencies
RUN npx -y playwright@1.57.0 install --with-deps

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Render uses PORT=10000
EXPOSE 10000

# Start your server
CMD ["npm", "start"]
