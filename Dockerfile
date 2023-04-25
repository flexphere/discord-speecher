FROM node:18-bullseye-slim as builder

RUN apt update && apt upgrade
RUN apt install -y   gcc make g++ python3

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install


FROM node:18-bullseye-slim
 

WORKDIR /workspace
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npm", "start"]
