# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy API files and dependencies
COPY api ./api
COPY package*.json ./

# Install production dependencies (including express and cors for self-hosted)
RUN npm install --production

# Expose ports
EXPOSE 3000 3001

# Start script that runs both frontend and API
CMD ["node", "api/server.js"]
