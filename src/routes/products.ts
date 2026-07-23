import fs from "fs";
import path from "path";
import { NextFunction, Response, Router } from "express";
import multer from "multer";
import { pool } from "../db/pool";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const uploadDir = path.join(process.cwd(), "uploads", "products");
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

export const productsRouter = Router({ mergeParams: true });

productsRouter.use(requireAuth);

async function requireOwnedPage(req: AuthedRequest, res: Response, next: NextFunction) {
  const [rows]: any = await pool.query("SELECT id, type FROM pages WHERE id = ? AND user_id = ?", [
    req.params.pageId,
    req.userId,
  ]);
  if (!rows.length) return res.status(404).json({ error: "Page not found" });
  (req as any).pageType = rows[0].type;
  next();
}

productsRouter.use(requireOwnedPage);

function requireCatalogEnabled(req: AuthedRequest, res: Response, next: NextFunction) {
  if ((req as any).pageType !== "store") {
    return res.status(400).json({ error: "El catálogo solo está disponible para páginas de tipo 'store'" });
  }
  next();
}

function mapProduct(row: any) {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    imagePath: row.image_path,
    category: row.category,
  };
}

const SELECT_FIELDS = "id, page_id, name, description, price, image_path, category";

productsRouter.get("/", async (req: AuthedRequest, res) => {
  const [rows]: any = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM products WHERE page_id = ? ORDER BY created_at DESC`,
    [req.params.pageId]
  );
  res.json(rows.map(mapProduct));
});

productsRouter.post("/", requireCatalogEnabled, upload.single("image"), async (req: AuthedRequest, res) => {
  const { name, description, price, category } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: "name y price son requeridos" });
  }
  const imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;
  const [result]: any = await pool.query(
    "INSERT INTO products (page_id, name, description, price, image_path, category) VALUES (?, ?, ?, ?, ?, ?)",
    [req.params.pageId, name, description ?? null, price, imagePath, category ?? null]
  );
  const [rows]: any = await pool.query(`SELECT ${SELECT_FIELDS} FROM products WHERE id = ?`, [
    result.insertId,
  ]);
  res.status(201).json(mapProduct(rows[0]));
});

productsRouter.put("/:productId", upload.single("image"), async (req: AuthedRequest, res) => {
  const [existing]: any = await pool.query(
    "SELECT id, image_path FROM products WHERE id = ? AND page_id = ?",
    [req.params.productId, req.params.pageId]
  );
  if (!existing.length) return res.status(404).json({ error: "Product not found" });

  const { name, description, price, category } = req.body;
  const imagePath = req.file ? `/uploads/products/${req.file.filename}` : existing[0].image_path;

  await pool.query(
    "UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), image_path = ?, category = COALESCE(?, category) WHERE id = ?",
    [name ?? null, description ?? null, price ?? null, imagePath, category ?? null, req.params.productId]
  );
  const [rows]: any = await pool.query(`SELECT ${SELECT_FIELDS} FROM products WHERE id = ?`, [
    req.params.productId,
  ]);
  res.json(mapProduct(rows[0]));
});

productsRouter.delete("/:productId", async (req: AuthedRequest, res) => {
  const [result]: any = await pool.query("DELETE FROM products WHERE id = ? AND page_id = ?", [
    req.params.productId,
    req.params.pageId,
  ]);
  if (!result.affectedRows) return res.status(404).json({ error: "Product not found" });
  res.status(204).send();
});
