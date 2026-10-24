import { migrateDatabase } from './app';
import { runtime } from './runtime';
const { database, options } = runtime();
try {
  await migrateDatabase(database, options);
  console.log('Database migrations applied.');
} finally {
  database.close();
}
