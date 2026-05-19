FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8001
EXPOSE 50051

CMD ["node", "sensores.js"]