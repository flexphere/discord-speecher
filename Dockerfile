FROM node:22-bullseye-slim as builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install


FROM node:22-bullseye-slim
 

WORKDIR /workspace
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npm", "start"]
