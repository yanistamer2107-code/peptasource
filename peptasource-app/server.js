// PeptaSource Labs — serveur Express + API
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';
import { seed } from './seed.js';

// Crée automatiquement l'admin, les réglages et le catalogue si la base est vide
// (permet un déploiement sans étape manuelle).
seed();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(cookieParser());

// ---------- Helpers ----------
const euro = (c) => (c / 100).toFixed(2);
function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, status: user.status }, JWT_SECRET, { expiresIn: '7d' });
}
function setAuthCookie(res, token) {
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 7 * 864e5 });
}
function currentUser(req) {
  const t = req.cookies?.token;
  if (!t) return null;
  try {
    const p = jwt.verify(t, JWT_SECRET);
    return db.prepare('SELECT id,email,role,status,contact_name,lab_name,accreditation,country,phone FROM users WHERE id=?').get(p.id) || null;
  } catch { return null; }
}
function requireAuth(req, res, next) {
  const u = currentUser(req);
  if (!u) return res.status(401).json({ error: 'Non authentifié' });
  req.user = u; next();
}
function requireApprovedLab(req, res, next) {
  if (req.user.role !== 'admin' && req.user.status !== 'approved')
    return res.status(403).json({ error: 'Compte laboratoire en attente de validation' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé à l’administration' });
  next();
}
const getSetting = (k) => db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value ?? '';
function allSettings() {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ================= AUTH =================
app.post('/api/auth/register', (req, res) => {
  const { email, password, contact_name, lab_name, accreditation, country, phone } = req.body || {};
  if (!email || !password || !lab_name || !accreditation)
    return res.status(400).json({ error: 'Email, mot de passe, nom du laboratoire et n° d’habilitation sont requis.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum.' });
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email);
  if (exists) return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  const info = db.prepare(`INSERT INTO users(email,password_hash,role,contact_name,lab_name,accreditation,country,phone,status)
                           VALUES(?,?,?,?,?,?,?,?,'pending')`)
    .run(email, bcrypt.hashSync(password, 10), 'lab', contact_name || '', lab_name, accreditation, country || '', phone || '');
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  setAuthCookie(res, sign(user));
  res.json({ ok: true, user: { email: user.email, role: user.role, status: user.status, lab_name: user.lab_name },
             message: 'Compte créé. Il sera actif après validation de votre habilitation par notre équipe.' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.password_hash))
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  setAuthCookie(res, sign(user));
  res.json({ ok: true, user: { email: user.email, role: user.role, status: user.status, lab_name: user.lab_name, contact_name: user.contact_name } });
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/auth/me', (req, res) => {
  const u = currentUser(req);
  if (!u) return res.json({ user: null });
  res.json({ user: { email: u.email, role: u.role, status: u.status, lab_name: u.lab_name, contact_name: u.contact_name } });
});

// ================= PRODUITS (public) =================
app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT id,ref,name,category,format,purity,description,price_cents,stock FROM products WHERE active=1 ORDER BY category,ref').all();
  res.json({ products: rows.map(p => ({ ...p, price: euro(p.price_cents), in_stock: p.stock > 0 })) });
});

// ================= COMMANDES (labo approuvé) =================
app.post('/api/orders', requireAuth, requireApprovedLab, (req, res) => {
  const { items, payment_method, note } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Panier vide.' });
  if (!['virement', 'crypto'].includes(payment_method)) return res.status(400).json({ error: 'Mode de paiement invalide.' });

  function runTx() {
    let total = 0;
    const resolved = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(it.id);
      if (!p) throw { code: 400, msg: `Produit introuvable (id ${it.id}).` };
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      if (p.stock < qty) throw { code: 409, msg: `Stock insuffisant pour ${p.ref} (reste ${p.stock}).` };
      total += p.price_cents * qty;
      resolved.push({ p, qty });
    }
    const year = new Date().getFullYear();
    const seq = (db.prepare("SELECT COUNT(*) c FROM orders").get().c + 1).toString().padStart(6, '0');
    const reference = `PS-${year}-${seq}`;
    const info = db.prepare(`INSERT INTO orders(reference,user_id,total_cents,payment_method,status,note)
                             VALUES(?,?,?,?, 'awaiting_payment', ?)`)
      .run(reference, req.user.id, total, payment_method, note || '');
    const oid = info.lastInsertRowid;
    const addItem = db.prepare(`INSERT INTO order_items(order_id,product_id,ref,name,unit_cents,qty) VALUES(?,?,?,?,?,?)`);
    const dec = db.prepare('UPDATE products SET stock = stock - ? WHERE id=?');
    for (const { p, qty } of resolved) { addItem.run(oid, p.id, p.ref, p.name, p.price_cents, qty); dec.run(qty, p.id); }
    return { reference, total_cents: total, id: oid };
  }

  try {
    let out;
    db.exec('BEGIN');
    try { out = runTx(); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    const s = allSettings();
    const instructions = req.body.payment_method === 'crypto'
      ? { type: 'crypto', btc: s.crypto_btc, usdt_trc20: s.crypto_usdt }
      : { type: 'virement', holder: s.bank_holder, iban: s.bank_iban, bic: s.bank_bic };
    res.json({ ok: true, reference: out.reference, total: euro(out.total_cents),
               payment: instructions, contact: s.company_email,
               message: 'Commande enregistrée. Réglez le montant en indiquant la référence, puis notre équipe validera votre commande.' });
  } catch (e) {
    if (e && e.code) return res.status(e.code).json({ error: e.msg });
    console.error(e); res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/api/orders/mine', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: orders.map(o => ({ ...o, total: euro(o.total_cents), items: items.all(o.id) })) });
});

// ================= ADMIN =================
app.use('/api/admin', requireAuth, requireAdmin);

app.get('/api/admin/stats', (req, res) => {
  const paidStatuses = "('paid','shipped')";
  const revenue = db.prepare(`SELECT COALESCE(SUM(total_cents),0) s FROM orders WHERE status IN ${paidStatuses}`).get().s;
  const orders_total = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  const awaiting = db.prepare("SELECT COUNT(*) c FROM orders WHERE status='awaiting_payment'").get().c;
  const pending_labs = db.prepare("SELECT COUNT(*) c FROM users WHERE role='lab' AND status='pending'").get().c;
  const low_stock = db.prepare('SELECT ref,name,stock,low_stock FROM products WHERE active=1 AND stock<=low_stock ORDER BY stock ASC').all();
  const recent = db.prepare(`SELECT o.reference,o.total_cents,o.status,o.created_at,u.lab_name
                             FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 6`).all();
  res.json({
    revenue: euro(revenue), orders_total, awaiting, pending_labs,
    products_count: db.prepare('SELECT COUNT(*) c FROM products WHERE active=1').get().c,
    low_stock,
    recent: recent.map(r => ({ ...r, total: euro(r.total_cents) }))
  });
});

// ---- Produits (CRUD) ----
app.get('/api/admin/products', (req, res) => {
  res.json({ products: db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(p => ({ ...p, price: euro(p.price_cents) })) });
});
app.post('/api/admin/products', (req, res) => {
  const b = req.body || {};
  if (!b.ref || !b.name) return res.status(400).json({ error: 'Référence et nom requis.' });
  try {
    const info = db.prepare(`INSERT INTO products(ref,name,category,format,purity,description,price_cents,stock,low_stock,active)
                             VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(b.ref, b.name, b.category || '', b.format || '', b.purity || '', b.description || '',
           Math.round((b.price || 0) * 100), parseInt(b.stock || 0, 10), parseInt(b.low_stock || 5, 10), b.active ? 1 : 1);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) { res.status(409).json({ error: 'Référence déjà utilisée.' }); }
});
app.put('/api/admin/products/:id', (req, res) => {
  const b = req.body || {};
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produit introuvable.' });
  db.prepare(`UPDATE products SET ref=?,name=?,category=?,format=?,purity=?,description=?,price_cents=?,stock=?,low_stock=?,active=? WHERE id=?`)
    .run(b.ref ?? p.ref, b.name ?? p.name, b.category ?? p.category, b.format ?? p.format, b.purity ?? p.purity,
         b.description ?? p.description,
         b.price != null ? Math.round(b.price * 100) : p.price_cents,
         b.stock != null ? parseInt(b.stock, 10) : p.stock,
         b.low_stock != null ? parseInt(b.low_stock, 10) : p.low_stock,
         b.active != null ? (b.active ? 1 : 0) : p.active,
         req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Commandes ----
app.get('/api/admin/orders', (req, res) => {
  const orders = db.prepare(`SELECT o.*, u.lab_name, u.email, u.contact_name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  res.json({ orders: orders.map(o => ({ ...o, total: euro(o.total_cents), items: items.all(o.id) })) });
});
app.patch('/api/admin/orders/:id', (req, res) => {
  const { status } = req.body || {};
  const allowed = ['awaiting_payment', 'paid', 'shipped', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  // Si annulation d'une commande non expédiée : on réapprovisionne le stock
  if (status === 'cancelled' && order.status !== 'cancelled' && order.status !== 'shipped') {
    const its = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id=?');
    for (const it of its) if (it.product_id) inc.run(it.qty, it.product_id);
  }
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

// ---- Comptes labos ----
app.get('/api/admin/customers', (req, res) => {
  const rows = db.prepare(`SELECT id,email,contact_name,lab_name,accreditation,country,phone,status,created_at,
                           (SELECT COUNT(*) FROM orders WHERE user_id=users.id) AS orders_count
                           FROM users WHERE role='lab' ORDER BY id DESC`).all();
  res.json({ customers: rows });
});
app.patch('/api/admin/customers/:id', (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
  db.prepare("UPDATE users SET status=? WHERE id=? AND role='lab'").run(status, req.params.id);
  res.json({ ok: true });
});

// ---- Réglages (paiement) ----
app.get('/api/admin/settings', (req, res) => res.json({ settings: allSettings() }));
app.put('/api/admin/settings', (req, res) => {
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) up.run(k, String(v));
  res.json({ ok: true });
});

// Instructions de paiement publiques (affichées au checkout)
app.get('/api/payment-info', (req, res) => {
  const s = allSettings();
  res.json({ company_email: s.company_email });
});

// ---------- Static ----------
app.use(express.static(join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'public', 'admin.html')));
app.get('/compte', (req, res) => res.sendFile(join(__dirname, 'public', 'account.html')));

app.listen(PORT, () => console.log(`✔ PeptaSource en ligne sur http://localhost:${PORT}`));
