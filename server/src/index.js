import { createApp } from './app.js';
import { migrate } from './db.js';
import { loadEnv } from './env.js';
import { seedIfEmpty } from './seed.js';

loadEnv();
migrate();
if (process.env.NOTELY_AUTO_SEED !== '0') seedIfEmpty();

const port = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(port, '127.0.0.1', () => {
  console.log(`Notely API listening on http://127.0.0.1:${port}`);
});
