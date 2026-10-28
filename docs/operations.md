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

Apply migrations with `npx prisma migrate deploy` on a server. Use `npx prisma migrate dev` only on a development database.

Take a nightly database dump and a copy of the private file store. Keep both from the same night so a restore puts documents back with the rows that point at them.

```bash
mkdir -p /var/backups/golden-child
stamp=$(date +%F)
pg_dump "$DATABASE_URL" --format=custom --file="/var/backups/golden-child/db-$stamp.dump"
rsync -a --delete "${STORAGE_DIR:-storage/private}/" "/var/backups/golden-child/files-$stamp/"
```

Restore onto an empty database, then put the files back before starting the app:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /var/backups/golden-child/db-YYYY-MM-DD.dump
rsync -a /var/backups/golden-child/files-YYYY-MM-DD/ "${STORAGE_DIR:-storage/private}/"
npx prisma migrate deploy
```

`--clean` drops objects already in the target database. Point it at the database you intend to replace.

## Email and files

Leave `SMTP_URL` empty and administrators issue reset links from Users and Permissions. Those links are shown once in the office. When `SMTP_URL` is set later, the same reset tokens can be mailed without changing the account flow.

Uploaded admission documents are written under `STORAGE_DIR` and downloaded only through `/api/documents/[id]` after an admissions permission check. There is no public file URL and no S3 requirement.

## Payments

The office records cash, mobile money, and bank transfers. Receipts say the payment was recorded by the school. The application does not claim a gateway verified it. Overpayment stays as unallocated credit. Corrections are reversals or adjustments with a reason.
