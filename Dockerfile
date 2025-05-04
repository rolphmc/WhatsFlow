FROM node:20-slim

# Instalar dependências para Puppeteer e WhatsApp Web.js
RUN apt-get update && apt-get install -y \
    chromium \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    gnupg \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libnss3 \
    libnspr4 \
    libx11-6 \
    libxcb1 \
    libxext6 \
    libxi6 \
    libgtk-3-0 \
    libglib2.0-0 \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Configurar diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências Node.js
RUN npm ci

# Copiar os arquivos da aplicação Python
COPY . .

# Configurar ambiente Python
RUN python3 -m venv venv
ENV PATH="/app/venv/bin:$PATH"

# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements_docker.txt

# Copiar e configurar o script de inicialização
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expor a porta da aplicação
EXPOSE 5000

# Usar o script de inicialização
ENTRYPOINT ["docker-entrypoint.sh"]

# Inicializar aplicação
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--reuse-port", "--reload", "main:app"]