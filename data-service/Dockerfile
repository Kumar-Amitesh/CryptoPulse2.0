FROM node:20-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /data-service

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "src/index.js" ]