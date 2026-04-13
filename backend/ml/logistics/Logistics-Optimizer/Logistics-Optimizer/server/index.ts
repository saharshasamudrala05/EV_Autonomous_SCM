import * as dotenv from "dotenv";
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";


const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Compression ───────────────────────────────────────────────────────────────
// Gzip/Brotli all responses before any other middleware runs.
// Optimization API responses (routes, polylines, fleet summary) are typically
// 30–80KB uncompressed — compression brings them to 8–20KB (~70% reduction).
// Run: npm install compression @types/compression
app.use(compression());

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    console.log('Setting up static file serving for production...');
    serveStatic(app);
  } else {
    console.log('Setting up Vite for development...');
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    console.log('Vite setup complete');
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`Attempting to start server on port ${port}...`);
  httpServer.listen(
    {
      port,
      host: "127.0.0.1",
    },
    () => {
      log(`serving on port ${port}`);
    },
  ).on('error', (err) => {
    console.error('Server failed to start:', err);
  });
})();