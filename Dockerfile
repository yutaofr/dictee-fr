FROM node:lts-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
