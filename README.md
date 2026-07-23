# pagebuilder-api

**DoppCore Manager Web Builder** — API microservice: Express + TypeScript sobre MariaDB. Expone el CRUD de páginas (landing/blog/store), sus bloques, productos y posts, además de la vista pública de páginas publicadas.

## Endpoints principales

Todos los endpoints bajo `/pages` requieren `Authorization: Bearer <JWT>` (el mismo secreto compartido con `pagebuilder-webapp`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/health` | Healthcheck |
| GET  | `/pages` | Lista las páginas del usuario autenticado |
| POST | `/pages` | Crea una página (`type`: `landing` \| `blog` \| `store`) |
| GET/PUT/DELETE | `/pages/:id` | Obtiene, actualiza o elimina una página (bloques, logo, nav, CTA, publicación) |
| CRUD | `/pages/:pageId/products` | Productos de una página tipo `store` |
| CRUD | `/pages/:pageId/posts` | Posts de una página tipo `blog` |
| GET  | `/public/pages/:slug` | Vista pública (sin auth) de una página publicada, con sus productos y posts |
| static | `/uploads/*` | Assets subidos (logos, imágenes) |

## Variables de entorno
Ver `.env.example`:
```
PORT=4000
JWT_SECRET=change-me-shared-with-webapp
DB_HOST=api-db
DB_PORT=3306
DB_USER=pagebuilder
DB_PASSWORD=pagebuilder
DB_NAME=pagebuilder_api
```

## Desarrollo local
```bash
npm install
npm run dev      # http://localhost:4000 (usa .env, ver .env.example)
```

## Build / Docker
```bash
npm run build && npm start
```
Ver `pagebuilder-deploy` para `docker-compose.yml`. Este contenedor debe exponerse por el puerto 4000.
