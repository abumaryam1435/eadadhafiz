import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Keep a persistent single instance of the browser to avoid expensive spawn on each request
let browserInstance: any = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
      console.warn("Failed to close old browser instance:", e);
    }
  }

  let puppeteer: any;
  try {
    const puppeteerModule = await import("puppeteer");
    puppeteer = puppeteerModule.default || puppeteerModule;
  } catch (err) {
    console.warn("Puppeteer import failed, trying puppeteer-core:", err);
    const puppeteerCoreModule = await import("puppeteer-core");
    puppeteer = puppeteerCoreModule.default || puppeteerCoreModule;
  }

  browserInstance = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--disable-features=IsolateOrigins,site-per-process',
      '--js-flags="--max-old-space-size=512"'
    ],
    headless: true,
  });
  
  return browserInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing large HTML payloads
  app.use(express.json({ limit: '50mb' }));

  // Health check routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/healthz", (_req, res) => {
    res.send("ok");
  });

  // Server-side proxy for Quran page text (bypasses browser CORS & network restrictions)
  const quranServerCache = new Map<number, any>();
  app.get("/api/quran-page-text/:page", async (req, res) => {
    const pageNum = parseInt(req.params.page, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
      res.status(400).json({ error: "Invalid page number" });
      return;
    }

    if (quranServerCache.has(pageNum)) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json(quranServerCache.get(pageNum));
      return;
    }

    try {
      const upstreamUrl = `https://api.quran.com/api/v4/verses/by_page/${pageNum}?words=true&per_page=50&word_fields=text_uthmani,line_number,position`;
      const response = await fetch(upstreamUrl, {
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Upstream returned ${response.status}`);
      }

      const data = await response.json();
      quranServerCache.set(pageNum, data);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.json(data);
    } catch (err: any) {
      console.error(`Failed to fetch page ${pageNum} from upstream:`, err?.message || err);
      res.status(502).json({ error: "Failed to fetch page text from upstream", details: err?.message });
    }
  });

  // API constraints
  app.post("/api/pdf", async (req, res) => {
    let page: any = null;
    let browser: any = null;
    try {
      const { html, orientation = "landscape" } = req.body;
      
      if (!html) {
        res.status(400).send("محتوى HTML مفقود");
        return;
      }

      console.log("Launching/getting browser...");
      // Reuse browser instance
      const browser = await getBrowser();

      console.log("Creating new page...");
      page = await browser.newPage();
      
      console.log("Setting content...");
      // Wait for network idle so Google Fonts finish loading before rendering PDF
      try {
        await page.setContent(html, { waitUntil: "networkidle0" as any, timeout: 12000 });
      } catch (e) {
        console.warn("networkidle0 timeout, falling back to domcontentloaded:", e);
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
      }
      
      console.log("Evaluating fonts...");
      // Explicitly wait for fonts to load and apply
      try {
        await page.evaluate(async () => {
          if (document.fonts) {
            await Promise.race([
              document.fonts.ready,
              new Promise(resolve => setTimeout(resolve, 3000))
            ]);
          }
        });
      } catch (e) {
        console.warn("Font loading timeout:", e);
      }

      console.log("Generating PDF...");
      await page.emulateMediaType('print');
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: orientation === "landscape",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "4mm",
          right: "4mm",
          bottom: "4mm",
          left: "4mm",
        },
        timeout: 60000
      });
      console.log("PDF generated successfully.");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
      res.status(200).send(Buffer.from(pdfBuffer));
      
    } catch (error: any) {
      console.error("Error creating PDF:", error);
      res.status(500).send("Internal Server Error: " + error.message);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error("Failed to close page:", e);
        }
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
