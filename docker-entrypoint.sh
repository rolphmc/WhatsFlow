#!/bin/bash
set -e

# Função para testar a conexão com o PostgreSQL
function postgres_ready(){
python3 << END
import sys
import psycopg2
import os
try:
    dbname = os.environ.get("DATABASE_URL")
    conn = psycopg2.connect(dbname)
except psycopg2.OperationalError:
    sys.exit(-1)
sys.exit(0)
END
}

# Aguardar até que o PostgreSQL esteja pronto
until postgres_ready; do
  >&2 echo "PostgreSQL não está disponível ainda - aguardando..."
  sleep 1
done

>&2 echo "PostgreSQL está pronto - continuando..."

# Executar o comando passado para o script
exec "$@"