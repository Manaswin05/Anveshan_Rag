# Stage 1: Build the React frontend
FROM node:20-alpine as build-stage
WORKDIR /app
COPY static/package*.json ./
RUN npm install
COPY static/ .
RUN npm run build

# Stage 2: Serve with Python Flask and Gunicorn
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python application files
COPY server.py .
COPY rag_engine.py .

# Copy built static files from the build stage
COPY --from=build-stage /app/dist /app/static/dist

# Render.com provides the PORT environment variable.
# We'll use gunicorn to serve the Flask app, binding to 0.0.0.0:
CMD gunicorn server:app --bind 0.0.0.0: --workers 2 --threads 4
