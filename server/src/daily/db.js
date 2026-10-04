// Connessione al database dell'Anno del Giorno.
//   DATABASE_URL presente → Postgres (Neon in produzione) tramite un Pool di `pg`.
//   assente               → PGlite in memoria, solo per sviluppo locale: i dati
//                           spariscono al riavvio. In produzione PGlite non è
//                           installato (devDependency) e la sfida resta spenta.

import pg from 'pg';

export async function connectDailyDb(databaseUrl = process.env.DATABASE_URL) {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 4, idleTimeoutMillis: 30_000 });
    // Neon chiude le connessioni inattive: senza questo listener l'errore
    // di una connessione ferma nel pool farebbe cadere il processo.
    pool.on('error', (err) => console.error('[daily] connessione al database persa:', err.message));
    await pool.query('SELECT 1');
    return { db: pool, kind: 'postgres', close: () => pool.end() };
  }
  try {
    const { PGlite } = await import('@electric-sql/pglite');
    const lite = new PGlite();
    await lite.waitReady;
    console.warn('[daily] DATABASE_URL assente: uso un database in memoria (solo sviluppo, si azzera al riavvio)');
    return { db: lite, kind: 'memory', close: () => lite.close() };
  } catch {
    return null;
  }
}
