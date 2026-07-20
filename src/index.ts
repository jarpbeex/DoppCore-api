import cors from "cors";
import express from "express";
import { initSchema } from "./db/pool";
import { pagesRouter } from "./routes/pages";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/pages", pagesRouter);

const PORT = Number(process.env.PORT || 4000);

async function start() {
  await waitForDb();
  await initSchema();
  app.listen(PORT, () => console.log(`pagebuilder-api listening on ${PORT}`));
}

async function waitForDb(retries = 20, delayMs = 2000): Promise<void> {
  const { pool } = await import("./db/pool");
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Could not connect to database");
}

start().catch((err) => {
  console.error("Failed to start pagebuilder-api", err);
  process.exit(1);
});
