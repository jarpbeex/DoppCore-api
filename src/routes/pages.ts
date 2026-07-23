import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { pool } from "../db/pool";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { slugify } from "../lib/slugify";

export const pagesRouter = Router();

const PAGE_TYPES = ["landing", "blog", "store"] as const;
type PageType = (typeof PAGE_TYPES)[number];

const DEFAULT_CTA = { enabled: false, label: "Empezar", navItemId: null };

const logoUploadDir = path.join(process.cwd(), "uploads", "logos");
fs.mkdirSync(logoUploadDir, { recursive: true });

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: logoUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Solo se permiten imagenes"));
    cb(null, true);
  },
});

const assetUploadDir = path.join(process.cwd(), "uploads", "assets");
fs.mkdirSync(assetUploadDir, { recursive: true });

const assetUpload = multer({
  storage: multer.diskStorage({
    destination: assetUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Solo se permiten imagenes"));
    cb(null, true);
  },
});

const SELECT_FIELDS =
  "id, user_id AS userId, title, type, blocks, logo_path AS logoPath, nav_items AS navItems, cta, blog_subtitle AS blogSubtitle, published, slug, created_at AS createdAt, updated_at AS updatedAt";

pagesRouter.use(requireAuth);

pagesRouter.get("/", async (req: AuthedRequest, res) => {
  const [rows] = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM pages WHERE user_id = ? ORDER BY updated_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

pagesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const [rows]: any = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM pages WHERE id = ? AND user_id = ?`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  res.json(rows[0]);
});

pagesRouter.post("/", async (req: AuthedRequest, res) => {
  const { title, blocks, type, navItems, cta, blogSubtitle } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  if (type !== undefined && !PAGE_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${PAGE_TYPES.join(", ")}` });
  }
  const pageType: PageType = type ?? "landing";
  const [result]: any = await pool.query(
    "INSERT INTO pages (user_id, title, type, blocks, nav_items, cta, blog_subtitle) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      req.userId,
      title,
      pageType,
      JSON.stringify(blocks ?? []),
      JSON.stringify(navItems ?? []),
      JSON.stringify(cta ?? DEFAULT_CTA),
      blogSubtitle ?? null,
    ]
  );
  res.status(201).json({
    id: result.insertId,
    userId: req.userId,
    title,
    type: pageType,
    blocks: blocks ?? [],
    logoPath: null,
    navItems: navItems ?? [],
    cta: cta ?? DEFAULT_CTA,
    blogSubtitle: blogSubtitle ?? null,
  });
});

pagesRouter.put("/:id", async (req: AuthedRequest, res) => {
  const { title, blocks, published, type, navItems, cta, blogSubtitle } = req.body;
  if (type !== undefined && !PAGE_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${PAGE_TYPES.join(", ")}` });
  }
  const [existing]: any = await pool.query("SELECT id FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!existing.length) return res.status(404).json({ error: "Page not found" });

  await pool.query(
    "UPDATE pages SET title = COALESCE(?, title), type = COALESCE(?, type), blocks = COALESCE(?, blocks), nav_items = COALESCE(?, nav_items), cta = COALESCE(?, cta), blog_subtitle = COALESCE(?, blog_subtitle), published = COALESCE(?, published) WHERE id = ? AND user_id = ?",
    [
      title ?? null,
      type ?? null,
      blocks ? JSON.stringify(blocks) : null,
      navItems ? JSON.stringify(navItems) : null,
      cta ? JSON.stringify(cta) : null,
      blogSubtitle ?? null,
      published ?? null,
      req.params.id,
      req.userId,
    ]
  );
  res.json({ ok: true });
});

pagesRouter.patch("/:id/logo", logoUpload.single("logo"), async (req: AuthedRequest, res) => {
  const [existing]: any = await pool.query("SELECT id FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!existing.length) return res.status(404).json({ error: "Page not found" });
  if (!req.file) return res.status(400).json({ error: "logo file is required" });

  const logoPath = `/uploads/logos/${req.file.filename}`;
  await pool.query("UPDATE pages SET logo_path = ? WHERE id = ?", [logoPath, req.params.id]);
  res.json({ logoPath });
});

pagesRouter.delete("/:id/logo", async (req: AuthedRequest, res) => {
  const [existing]: any = await pool.query("SELECT id FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!existing.length) return res.status(404).json({ error: "Page not found" });

  await pool.query("UPDATE pages SET logo_path = NULL WHERE id = ?", [req.params.id]);
  res.json({ logoPath: null });
});

pagesRouter.post("/:id/assets", assetUpload.single("image"), async (req: AuthedRequest, res) => {
  const [existing]: any = await pool.query("SELECT id FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!existing.length) return res.status(404).json({ error: "Page not found" });
  if (!req.file) return res.status(400).json({ error: "image file is required" });

  res.status(201).json({ path: `/uploads/assets/${req.file.filename}` });
});

pagesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const [result]: any = await pool.query("DELETE FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!result.affectedRows) return res.status(404).json({ error: "Page not found" });
  res.status(204).send();
});

pagesRouter.patch("/:id/publish", async (req: AuthedRequest, res) => {
  const { published } = req.body as { published?: boolean };
  const [existing]: any = await pool.query(
    "SELECT id, title, slug FROM pages WHERE id = ? AND user_id = ?",
    [req.params.id, req.userId]
  );
  if (!existing.length) return res.status(404).json({ error: "Page not found" });
  const page = existing[0];

  if (published === false) {
    await pool.query("UPDATE pages SET published = FALSE WHERE id = ?", [page.id]);
    return res.json({ published: false, slug: page.slug });
  }

  let slug = page.slug;
  if (!slug) {
    const base = slugify(page.title);
    slug = base;
    let suffix = 1;
    for (;;) {
      const [clash]: any = await pool.query("SELECT id FROM pages WHERE slug = ? AND id != ?", [
        slug,
        page.id,
      ]);
      if (!clash.length) break;
      slug = `${base}-${suffix++}`;
    }
  }

  await pool.query("UPDATE pages SET published = TRUE, slug = ? WHERE id = ?", [slug, page.id]);
  res.json({ published: true, slug });
});
