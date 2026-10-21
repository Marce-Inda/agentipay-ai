# Use Node.js 20 LTS as the base image
FROM node:20-alpine

# Install libc6-compat for better compatibility
RUN apk add --no-cache libc6-compat

# Set the working directory in the container
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# Drop root privileges for runtime
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 && chown -R nextjs:nodejs /app

# Expose the port the app runs on
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs

# Start the application
CMD ["npm", "start"]
