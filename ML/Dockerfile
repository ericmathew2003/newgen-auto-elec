FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for opencv and psycopg2
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install TensorFlow CPU separately (large package)
RUN pip install --no-cache-dir tensorflow-cpu==2.15.0

# Install NLP packages for fault diagnosis
RUN pip install --no-cache-dir sentence-transformers==2.7.0

# Copy all ML service files
COPY . .

# Expose port (HuggingFace uses 7860)
EXPOSE 7860

# Set environment variable for port
ENV PORT=7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
