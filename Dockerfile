FROM node:20

# ffmpeg + python + pip + fonts
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip fontconfig fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Whisper CLI (с обходом PEP 668)
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install

COPY tsconfig.json ./
COPY src ./src
COPY src/config/defaults.json ./src/config/defaults.json

ENV PORT=4123
ENV LOG_LEVEL=debug
ENV OPENAI_API_KEY=""
ENV OPENAI_BASE_URL="https://openrouter.ai/api/v1"
ENV FONT_FILE="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

RUN npm run build

EXPOSE 4123
CMD ["npm", "start"]
