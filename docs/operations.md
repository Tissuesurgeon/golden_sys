# Operations

Golden Child School runs as one Next.js application with PostgreSQL. Money is stored as integer pesewas. Sessions live in the `Session` table. Documents stay on the server volume named by `STORAGE_DIR`.

Auth.js credentials cannot store database sessions, so sign-in writes a hashed session token in Postgres and an httpOnly cookie. Passwords are Argon2 hashes.

## First administrator

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the environment, then run:

```bash
npx prisma migrate deploy
npm run db:seed
```

`SEED_DEMO=0` creates the school structure and that administrator only. `SEED_DEMO=1` also loads development students, staff, and fee history. Do not use the demo seed for a live school.

## Migrations and backup

```bash
npx prisma migrate dev
pg_dump "$DATABASE_URL" > backup.sql
psql "$DATABASE_URL" < backup.sql
```

## Email and files

Leave `SMTP_URL` empty and administrators issue reset links from Users and Permissions. Those links are shown once in the office. When `SMTP_URL` is set later, the same reset tokens can be mailed without changing the account flow.

Uploaded admission documents are written under `STORAGE_DIR` and downloaded only through `/api/documents/[id]` after an admissions permission check. There is no public file URL and no S3 requirement.

## Payments

The office records cash, mobile money, and bank transfers. Receipts say the payment was recorded by the school. The application does not claim a gateway verified it. Overpayment stays as unallocated credit. Corrections are reversals or adjustments with a reason.
