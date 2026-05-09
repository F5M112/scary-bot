import { startPlatformBot as start, restoreCustomBots } from './botManager.js';

export async function startPlatformBot() {
  await start();
  await restoreCustomBots();
}
