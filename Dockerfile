FROM node:current-alpine

WORKDIR /workspace

RUN apk update && apk upgrade
RUN apk add gcc make g++ ffmpeg python3

COPY package.json package-lock.json ./
RUN npm install

COPY . .
CMD ["npm", "start"]
