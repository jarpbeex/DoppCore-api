import { Router } from "express";
import { pool } from "../db/pool";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { slugify } from "../lib/slugify";

export const pagesRouter = Router();

pagesRouter.use(requireAuth);

pagesRouter.get("/", async (req: AuthedRequest, res) => {
  const [rows] = await pool.query(
    "SELECT id, user_id AS userId, title, blocks, published, slug, created_at AS createdAt, updated_at AS updatedAt FROM pages WHERE user_id = ? ORDER BY updated_at DESC",
    [req.userId]
  );
  res.json(rows);
});

pagesRouter.get("/:id", async (req: AuthedRequest, res) => {
  const [rows]: any = await pool.query(
    "SELECT id, user_id AS userId, title, blocks, published, slug, created_at AS createdAt, updated_at AS updatedAt FROM pages WHERE id = ? AND user_id = ?",
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  res.json(rows[0]);
});

pagesRouter.post("/", async (req: AuthedRequest, res) => {
  const { title, blocks } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const [result]: any = await pool.query(
    "INSERT INTO pages (user_id, title, blocks) VALUES (?, ?, ?)",
    [req.userId, title, JSON.stringify(blocks ?? [])]
  );
  res.status(201).json({ id: result.insertId, userId: req.userId, title, blocks: blocks ?? [] });
});

pagesRouter.put("/:id", async (req: AuthedRequest, res) => {
  const { title, blocks, published } = req.body;
  const [existing]: any = await pool.query("SELECT id FROM pages WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.userId,
  ]);
  if (!existing.length) return res.status(404).json({ error: "Page not found" });

  await pool.query(
    "UPDATE pages SET title = COALESCE(?, title), blocks = COALESCE(?, blocks), published = COALESCE(?, published) WHERE id = ? AND user_id = ?",
    [title ?? null, blocks ? JSON.stringify(blocks) : null, published ?? null, req.params.id, req.userId]
  );
  res.json({ ok: true });
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
