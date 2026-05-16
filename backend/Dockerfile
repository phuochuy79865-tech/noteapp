FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    vips-dev \
    openssl \
    openssl-dev

# Copy package files
COPY package*.json ./

# Copy Prisma schema
COPY prisma ./prisma/

# Install Node.js dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source
COPY src ./src/

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose backend port
EXPOSE 4000

# Start application
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]