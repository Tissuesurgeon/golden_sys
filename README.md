# Golden Child School

Records, fees, and report cards for Golden Child School in Koforidua. Administrators and the bursar run admissions, invoices, and the finance report. Teachers see only their classes, marks, attendance, and report cards.

Money is stored as integer pesewas. The crest used in the interface is `public/images/golden-child-school-logo.jpg`.

## Local run

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000. Set `DATABASE_URL` and `AUTH_SECRET` in `.env`. `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` create the first administrator when `SEED_DEMO=0`.

`SEED_DEMO=1` is for development only. It wipes domain tables and loads sample students, staff, and fees. Demo passwords are `knowledge`.

```bash
npm test
npm run test:e2e
```

## Deploy

`Dockerfile.vercel` is the container Vercel builds. It listens on port 80, runs `prisma migrate deploy` on startup, and keeps uploads under `STORAGE_DIR`. The local `Dockerfile` listens on port 3000. Set `DATABASE_URL`, `AUTH_SECRET`, and the administrator variables in the host environment. Uploaded files on Vercel do not survive a new container unless `STORAGE_DIR` is a persistent volume.

See `docs/operations.md` for nightly `pg_dump` and `STORAGE_DIR` backups.
