FROM node:current-alpine as builder

RUN apk update && apk upgrade
RUN apk add gcc make g++ python3

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install


FROM node:current-alpine

WORKDIR /workspace
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npm", "start"]
