import { app } from 'electron';
app.whenReady().then(() => {
  console.log(JSON.stringify({ argv: process.argv }));
  app.exit(0);
});
