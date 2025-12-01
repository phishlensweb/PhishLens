# File: Dockerfile
# Author: Swathi Pallikala
# Project: PhishLens
# Purpose:
#  - Containerize the Node/Express backend for Cloud Run deployment.
#  - Uses a slim Node image, installs only prod deps, and runs `server.js`.

# 1) Base image (LTS Node)
FROM node:20-slim

# 2) Work directory
WORKDIR /app

# 3) Copy only package files first (leverage Docker layer caching)
COPY package.json package-lock.json* ./

# 4) Install only production dependencies in the image
RUN npm install --only=production

# 5) Copy the rest of the source
COPY . .

# 6) Environment (Cloud Run will provide real env vars; these are safe defaults)
ENV NODE_ENV=production \
    PORT=8080

# 7) Expose port for local runs (Cloud Run ignores EXPOSE but it's good documentation)
EXPOSE 8080

# 8) Start the server
CMD ["node", "server.js"]
