const express = require("express");
const multer = require("multer");
const QRCode = require("qrcode");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "items.json");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-origin" }
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(ROOT, "public")));

const createLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
const readLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false });

const allowedMime = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(18).toString("hex"))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMime.has(file.mimetype)) return cb(new Error("Unsupported file type. Use JPG, PNG, WEBP, GIF, PDF, TXT, DOC or DOCX."));
    cb(null, true);
  }
});

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return {}; }
}
function writeDb(db) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function makeToken() { return crypto.randomBytes(32).toString("base64url"); }
function cleanName(name) { return path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "download"; }

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/items", createLimiter, upload.single("file"), async (req, res) => {
  try {
    const type = String(req.body.type || "");
    const title = String(req.body.title || "").trim().slice(0, 80);
    const text = String(req.body.text || "").trim().slice(0, 10000);

    if (!["image", "document", "phone", "text"].includes(type)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Choose a valid content type." });
    }
    if (["image", "document"].includes(type) && !req.file) {
      return res.status(400).json({ error: "Please select a file to upload." });
    }
    if (type === "image" && !req.file.mimetype.startsWith("image/")) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Please upload an image file." });
    }
    if (type === "document" && req.file.mimetype.startsWith("image/")) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Please upload a document, not an image." });
    }
    if (["phone", "text"].includes(type) && !text) {
      return res.status(400).json({ error: type === "phone" ? "Enter a phone number." : "Enter some text." });
    }
    if (type === "phone" && !/^[+\d\s().-]{5,25}$/.test(text)) {
      return res.status(400).json({ error: "Enter a valid phone number." });
    }

    const token = makeToken();
    const item = {
      token, type, title: title || (type === "phone" ? "Phone number" : type === "image" ? "Image" : type === "document" ? "Document" : "Text"),
      text: ["phone", "text"].includes(type) ? text : null,
      filename: req.file ? path.basename(req.file.path) : null,
      originalName: req.file ? cleanName(req.file.originalname) : null,
      mime: req.file ? req.file.mimetype : null,
      createdAt: new Date().toISOString()
    };
    const db = readDb();
    db[token] = item;
    writeDb(db);

    const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const url = `${base}/v/${token}`;
    const qr = await QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: "M" });
    res.status(201).json({ url, qr, title: item.title });
  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Could not create the QR code. Please try again." });
  }
});

app.get("/api/items/:token", readLimiter, (req, res) => {
  const item = readDb()[req.params.token];
  if (!item) return res.status(404).json({ error: "This QR link is invalid or the item no longer exists." });
  const { type, title, text, originalName, mime, createdAt } = item;
  res.set("Cache-Control", "no-store");
  res.json({ type, title, text, originalName, mime, createdAt });
});

app.get("/api/items/:token/file", readLimiter, (req, res) => {
  const item = readDb()[req.params.token];
  if (!item || !item.filename) return res.status(404).json({ error: "File not found." });
  const filePath = path.join(UPLOAD_DIR, path.basename(item.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File is no longer available." });
  res.set("Cache-Control", "no-store");
  res.type(item.mime || "application/octet-stream");
  if (item.mime === "application/pdf" || (item.mime && item.mime.startsWith("image/"))) {
    res.set("Content-Disposition", `inline; filename="${item.originalName.replace(/["\\]/g, "_")}"`);
  } else {
    res.download(filePath, item.originalName);
    return;
  }
  res.sendFile(filePath);
});

app.get("/v/:token", (_req, res) => res.sendFile(path.join(ROOT, "public", "view.html")));

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File is too large. Maximum size is 10 MB." });
  }
  if (err) return res.status(400).json({ error: err.message || "Upload failed." });
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, () => console.log(`QR Magic is running at http://localhost:${PORT}`));
