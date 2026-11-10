import express from "express";
import { health } from "./routes/health.js";

const app = express();
app.use(express.json());
app.use("/api/health", health);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
