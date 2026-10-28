import "dotenv/config";
import { createApp } from "./app.js";
try {
  const { app, db } = await createApp();
  const portArg = process.argv.indexOf("--port");
  const port = Number(
    process.env.PORT || (portArg >= 0 ? process.argv[portArg + 1] : 3000),
  );
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`En casa: servidor listo en el puerto ${port}`),
  );
  function stop() {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
