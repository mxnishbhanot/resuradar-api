FROM mcr.microsoft.com/playwright:v1.48.2-focal

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 10000

CMD ["npm", "start"]
