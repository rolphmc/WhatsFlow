# WhatsApp Web Integration - Instruções de Implantação

Este documento contém as instruções para implantar a aplicação WhatsApp Web Integration em sua máquina local usando Docker.

## Pré-requisitos

- Docker e Docker Compose instalados em sua máquina
- Git para clonar o repositório

## Passos para Implantação

### 1. Clone o repositório

```bash
git clone <URL_DO_REPOSITÓRIO>
cd whatsapp-web-integration
```

### 2. Configuração de variáveis de ambiente

Opcionalmente, você pode editar o arquivo `docker-compose.yml` para alterar:
- Credenciais do banco de dados PostgreSQL
- Chave secreta do Flask
- Portas expostas

### 3. Construir e iniciar os containers

```bash
docker-compose up -d
```

Este comando irá:
- Construir a imagem do contêiner da aplicação
- Baixar a imagem do PostgreSQL
- Iniciar todos os serviços
- Configurar a rede entre os containers

### 4. Acessando a aplicação

Após iniciar os contêineres, a aplicação estará disponível em:

```
http://localhost:5000
```

### 5. Persistência de dados

Os dados são persistidos em:
- Volume Docker para o PostgreSQL
- Pastas montadas para sessões do WhatsApp (.wwebjs_auth e .wwebjs_cache)

### 6. Gerenciamento da aplicação

Para verificar os logs da aplicação:
```bash
docker-compose logs -f web
```

Para parar a aplicação:
```bash
docker-compose down
```

Para parar a aplicação e remover os volumes (cuidado, isso apagará todos os dados!):
```bash
docker-compose down -v
```

### 7. Resolução de problemas comuns

#### Erro de conexão com o banco de dados
- Verifique se o serviço do PostgreSQL está em execução: `docker-compose ps`
- Verifique os logs do PostgreSQL: `docker-compose logs postgres`

#### Erros com o WhatsApp Web
- Verifique os logs da aplicação: `docker-compose logs web`
- Se houver problemas com o Puppeteer (usado pelo WhatsApp Web.js), pode ser necessário ajustar o Dockerfile

#### Portas em uso
- Se a porta 5000 ou alguma das portas 3001-3010 já estiverem em uso, você pode mudar o mapeamento de portas no arquivo `docker-compose.yml`