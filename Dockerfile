FROM node:13.10.1-alpine3.10

WORKDIR /workspace
COPY . .
RUN apk update && apk upgrade
RUN apk add gcc make g++ ffmpeg python
RUN rm -rf node_modules
RUN yarn add ref@latest
RUN yarn install
CMD ["yarn", "start"]