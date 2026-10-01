import { buildContainer } from './infrastructure/config/container.js';
import { createApp } from './presentation/http/app.js';

const port = Number(process.env['PORT'] ?? 3000);
const app = createApp(buildContainer());

app.listen(port, '0.0.0.0', () => {
  console.log(`Willay API listening on http://localhost:${port}/api`);
});
