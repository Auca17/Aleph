import path from 'path';
import fs from 'fs';

export function ensureQvacWorkerPath() {
  if (!process.env.QVAC_WORKER_PATH) {
    const workerPath = path.resolve(
      process.cwd(),
      'node_modules/@qvac/sdk/dist/server/worker.js'
    );
    if (fs.existsSync(workerPath)) {
      process.env.QVAC_WORKER_PATH = workerPath;
    }
  }
}

ensureQvacWorkerPath();
