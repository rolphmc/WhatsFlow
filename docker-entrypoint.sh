#!/bin/bash
set -e

# Função para testar a conexão com o PostgreSQL
function postgres_ready(){
python3 << END
import sys
import psycopg2
import os
try:
    conn_string = os.environ.get("DATABASE_URL")
    conn = psycopg2.connect(conn_string)
    conn.close()
except Exception as e:
    print(f"Erro ao conectar ao PostgreSQL: {e}", file=sys.stderr)
    sys.exit(-1)
sys.exit(0)
END
}

# Aguardar até que o PostgreSQL esteja pronto
echo "Aguardando PostgreSQL inicializar..."
until postgres_ready; do
  echo "PostgreSQL não está disponível ainda - aguardando..."
  sleep 2
done

echo "PostgreSQL está pronto - continuando..."

# Inicializar o banco de dados (opcional)
echo "Inicializando o banco de dados..."
python -c "
from app import app, db
with app.app_context():
    db.create_all()
"

# Executar o comando passado para o script
echo "Iniciando a aplicação..."
exec "$@"