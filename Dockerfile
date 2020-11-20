FROM node:13.10.1-alpine3.10

WORKDIR /workspace

RUN apk update && apk upgrade
RUN apk add gcc make g++ ffmpeg python

COPY package.json package-lock.json ./
RUN npm install

COPY . .
CMD ["npm", "start"]