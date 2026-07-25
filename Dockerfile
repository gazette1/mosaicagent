FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
COPY tools ./tools
RUN npm run build
ENV NODE_ENV=production
# OPENAI_API_KEY and DEMO_PASSCODE come from the host's env settings
EXPOSE 8787
CMD ["node", "tools/demo-server.js"]
