import initial from '../lib/initial-data.json' with { type:'json' };
import { getCloudDatabase, initializeDatabase } from '../lib/database.mjs';

await initializeDatabase(await getCloudDatabase(),initial);
console.log('Estoq: banco inicializado. Registros existentes foram preservados.');
