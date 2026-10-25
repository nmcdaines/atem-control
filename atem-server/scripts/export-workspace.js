// Usage: node scripts/export-workspace.js /path/to/workspace.json
// Uses the same POSTGRES_* environment variables as the legacy server.
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const destination = process.argv[2];
  if (!destination) throw new Error('Provide a destination JSON path. Existing files will not be overwritten.');
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const devices = (await client.query('SELECT * FROM "device" ORDER BY id')).rows;
    const macros = (await client.query('SELECT * FROM "macro" ORDER BY id')).rows;
    const shortcuts = (await client.query('SELECT * FROM "shortcut" ORDER BY page, slot, id')).rows;
    await client.query('COMMIT');
    fs.writeFileSync(destination, JSON.stringify({ devices, macros, shortcuts }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Exported ${devices.length} devices, ${macros.length} macros and ${shortcuts.length} shortcuts.`);
  } finally {
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
