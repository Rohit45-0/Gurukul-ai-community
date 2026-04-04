## Community AI API

NestJS modular monolith for the teacher community MVP.

### Main capabilities

- invite + email OTP auth
- organization-local groups
- public group toggle across institutions
- posts, threaded comments, reactions, bookmarks, reports
- in-app notifications and digest queue placeholder
- S3-compatible uploads through MinIO

### Local setup

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
npm run start:dev
```

### Seeded accounts

- `rhea@northlight.edu` - org admin
- `anika@northlight.edu` - teacher
- `aarav@horizon.edu` - teacher
- `meera@horizon.edu` - org admin

Request an OTP for any seeded email; in development, the API response includes the code.

The bundled Docker Postgres is exposed on `localhost:5433`.
