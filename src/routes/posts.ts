import fs from "fs";
import path from "path";
import { NextFunction, Response, Router } from "express";
import multer from "multer";
import { pool } from "../db/pool";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const uploadDir = path.join(process.cwd(), "uploads", "posts");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
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

export const postsRouter = Router({ mergeParams: true });

postsRouter.use(requireAuth);

async function requireOwnedPage(req: AuthedRequest, res: Response, next: NextFunction) {
  const [rows]: any = await pool.query("SELECT id, type FROM pages WHERE id = ? AND user_id = ?", [
    req.params.pageId,
    req.userId,
  ]);
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  (req as any).pageType = rows[0].type;
  next();
}

postsRouter.use(requireOwnedPage);

function requireBlogEnabled(req: AuthedRequest, res: Response, next: NextFunction) {
  if ((req as any).pageType !== "blog") {
    return res.status(400).json({ error: "Las entradas solo están disponibles para páginas de tipo 'blog'" });
  }
  next();
}

function mapPost(row: any) {
  return {
    id: row.id,
    pageId: row.page_id,
    title: row.title,
    excerpt: row.excerpt,
    coverImagePath: row.cover_image_path,
    content: row.content,
  };
}

const SELECT_FIELDS = "id, page_id, title, excerpt, cover_image_path, content";

postsRouter.get("/", async (req: AuthedRequest, res) => {
  const [rows]: any = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM posts WHERE page_id = ? ORDER BY created_at DESC`,
    [req.params.pageId]
  );
  res.json(rows.map(mapPost));
});

postsRouter.post("/", requireBlogEnabled, upload.single("coverImage"), async (req: AuthedRequest, res) => {
  const { title, excerpt, content } = req.body;
  if (!title) {
    return res.status(400).json({ error: "title es requerido" });
  }
  const coverImagePath = req.file ? `/uploads/posts/${req.file.filename}` : null;
  const [result]: any = await pool.query(
    "INSERT INTO posts (page_id, title, excerpt, cover_image_path, content) VALUES (?, ?, ?, ?, ?)",
    [req.params.pageId, title, excerpt ?? null, coverImagePath, content ?? null]
  );
  const [rows]: any = await pool.query(`SELECT ${SELECT_FIELDS} FROM posts WHERE id = ?`, [
    result.insertId,
  ]);
  res.status(201).json(mapPost(rows[0]));
});

postsRouter.put("/:postId", upload.single("coverImage"), async (req: AuthedRequest, res) => {
  const [existing]: any = await pool.query(
    "SELECT id, cover_image_path FROM posts WHERE id = ? AND page_id = ?",
    [req.params.postId, req.params.pageId]
  );
  if (!existing.length) return res.status(404).json({ error: "Post not found" });

  const { title, excerpt, content } = req.body;
  const coverImagePath = req.file ? `/uploads/posts/${req.file.filename}` : existing[0].cover_image_path;

  await pool.query(
    "UPDATE posts SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt), content = COALESCE(?, content), cover_image_path = ? WHERE id = ?",
    [title ?? null, excerpt ?? null, content ?? null, coverImagePath, req.params.postId]
  );
  const [rows]: any = await pool.query(`SELECT ${SELECT_FIELDS} FROM posts WHERE id = ?`, [
    req.params.postId,
  ]);
  res.json(mapPost(rows[0]));
});

postsRouter.delete("/:postId", async (req: AuthedRequest, res) => {
  const [result]: any = await pool.query("DELETE FROM posts WHERE id = ? AND page_id = ?", [
    req.params.postId,
    req.params.pageId,
  ]);
  if (!result.affectedRows) return res.status(404).json({ error: "Post not found" });
  res.status(204).send();
});
