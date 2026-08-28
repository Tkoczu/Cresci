import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'data', 'gym-progress.sqlite');
const destination = path.join(root, 'backups', 'before-history-import-2026-08-26.sqlite');
if (fs.existsSync(destination)) throw new Error(`Kopia już istnieje: ${destination}`);
const db = new DatabaseSync(source);
db.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
console.log(JSON.stringify({ destination, ...db.prepare('SELECT (SELECT COUNT(*) FROM exercises) AS exercises, (SELECT COUNT(*) FROM progress_entries) AS entries').get() }));
db.close();
