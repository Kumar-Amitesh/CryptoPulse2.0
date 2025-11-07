FROM node:20-slim

WORKDIR /api-gateway

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "src/index.js" ]