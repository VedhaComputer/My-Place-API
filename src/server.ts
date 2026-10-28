import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    const app = createApp();
    app.listen(env.PORT, () => {
      console.log(`🚀 India Place API running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (error) {
    console.error('Failed to start India Place API server:', error);
    process.exit(1);
  }
}

startServer();
