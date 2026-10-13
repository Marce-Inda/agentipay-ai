# Use Node.js 20 LTS as the base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./

# Install all dependencies first (including devDependencies for build)
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Now remove devDependencies for production to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
