FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY data/config.example.json ./data/config.example.json

# No dependencies to install -- this build is Node.js core modules only.
RUN mkdir -p /app/data

VOLUME ["/app/data"]
EXPOSE 3001

CMD ["node", "server.js"]
