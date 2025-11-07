FROM node:20-slim

WORKDIR /data-service

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "src/index.js" ]