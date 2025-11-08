# Drizzle Migrations

1. Update table definitions in `src/db/schema.ts`.
2. Run `pnpm db:push` (calls `drizzle-kit push`) from `app/backend` to sync the SQLite file.
3. Generated SQL ends up here for source control.
4. Never edit SQL manually; regenerate if needed.
