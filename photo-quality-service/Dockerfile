# ── Base image: Python 3.11 slim ──────────────────────────────
FROM python:3.11-slim

# Dependensi sistem untuk OpenCV dan MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies terlebih dahulu (layer cache lebih efisien)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin source code
COPY . .

# Buat user non-root untuk keamanan
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 6000

# Jalankan uvicorn dengan reload untuk development, tanpa reload untuk production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "6000", "--reload"]
