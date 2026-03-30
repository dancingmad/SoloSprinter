# Stage 1: build the React client
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies and build
COPY client/package*.json ./client/
RUN npm --prefix client ci

COPY client/ ./client/
RUN npm --prefix client run build


# Stage 2: production image
FROM node:20-alpine

WORKDIR /app

# Install server dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy the built client assets from the builder stage
COPY --from=builder /app/client/dist ./client/dist

# Data directory — mount a volume here to persist board data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
