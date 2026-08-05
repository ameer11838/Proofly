import { createApp } from './app.js';
import { getConfig } from './config/env.js';

const config = getConfig();
const app = createApp();

app.listen(config.port, () => {
  console.log(`Proofly API listening on http://localhost:${config.port}`);
});
