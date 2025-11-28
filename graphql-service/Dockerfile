FROM node:20-slim

WORKDIR /graphql-service

COPY package*.json ./

RUN npm install

# Copy remaining application code
COPY . .

CMD [ "node", "src/index.js" ]