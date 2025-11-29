FROM node:20-slim

WORKDIR /graphql-service

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "src/index.js" ]