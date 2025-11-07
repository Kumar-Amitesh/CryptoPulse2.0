FROM node:20-slim

WORKDIR /auth-service

COPY package*.json ./

RUN npm install

# Create the directory for multer uploads
# RUN mkdir -p public/temp

COPY . .

# app binds to port 8001
# EXPOSE 8001

CMD [ "node", "src/index.js" ]