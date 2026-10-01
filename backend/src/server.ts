import { env } from './infrastructure/config/env.js';
import { buildContainer } from './infrastructure/config/container.js';
import { createApp } from './presentation/http/app.js';

const app = createApp(buildContainer());

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Willay API listening on http://localhost:${env.port}/api`);
});
