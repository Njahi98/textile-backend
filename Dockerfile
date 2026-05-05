FROM node:22-trixie-slim

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && npm run dev"
