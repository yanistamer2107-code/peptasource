// Peuplement initial : admin, réglages de paiement, produits.
// Exécuté automatiquement au démarrage du serveur (idempotent),
// et utilisable en direct via `npm run seed`.
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import db from './db.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@peptasource.example';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

function upsertSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, value);
}

export function seed({ log = false } = {}) {
  // --- Admin ---
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email=?').get(ADMIN_EMAIL);
  if (!existingAdmin) {
    db.prepare(`INSERT INTO users(email,password_hash,role,contact_name,lab_name,status)
                VALUES(?,?,?,?,?,?)`)
      .run(ADMIN_EMAIL, bcrypt.hashSync(ADMIN_PASSWORD, 10), 'admin', 'Administrateur', 'PeptaSource Labs', 'approved');
    if (log) console.log('✔ Admin créé :', ADMIN_EMAIL);
  } else if (log) console.log('• Admin déjà présent :', ADMIN_EMAIL);

  // --- Réglages de paiement (modifiables dans l'admin) ---
  if (!db.prepare('SELECT value FROM settings WHERE key=?').get('bank_holder')) {
    upsertSetting('bank_holder', 'PeptaSource Labs SAS');
    upsertSetting('bank_iban', 'FR76 0000 0000 0000 0000 0000 000');
    upsertSetting('bank_bic', 'XXXXXXXX');
    upsertSetting('crypto_btc', 'bc1qexampleexampleexampleexampleexampl');
    upsertSetting('crypto_usdt', 'TExampleExampleExampleExampleExample');
    upsertSetting('company_email', 'contact@peptasource.example');
  }

  // --- Produits (uniquement si le catalogue est vide) ---
  const count = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (count === 0) {
    const products = [
      { ref:'A-11', name:'Peptide de recherche A-11', category:'Recherche métabolique', format:'Lyophilisat · fiole 5 mg', purity:'≥ 99%', price:4900, stock:42, low:8, desc:'Analyse HPLC + MS jointe. Reconstitution en solution stérile requise. Conservation à −20°C.' },
      { ref:'A-12', name:'Peptide de recherche A-12', category:'Recherche métabolique', format:'Lyophilisat · fiole 10 mg', purity:'≥ 99%', price:8900, stock:23, low:6, desc:'Séquence vérifiée, traçabilité complète. Certificat d’analyse par lot.' },
      { ref:'B-24', name:'Peptide de recherche B-24', category:'Recherche cellulaire', format:'Lyophilisat · fiole 2 mg', purity:'≥ 98%', price:3600, stock:5, low:6, desc:'Documentation technique disponible. Livraison en chaîne du froid.' },
      { ref:'B-25', name:'Peptide de recherche B-25', category:'Recherche cellulaire', format:'Lyophilisat · fiole 5 mg', purity:'≥ 98%', price:5400, stock:0, low:5, desc:'Contrôle qualité multi-paramètres. Fiche de sécurité (FDS) fournie.' },
      { ref:'C-08', name:'Peptide de recherche C-08', category:'Peptidomimétique', format:'Lyophilisat · fiole 5 mg', purity:'≥ 99%', price:7200, stock:17, low:5, desc:'Synthèse sur commande possible. Certificat d’analyse par lot.' },
      { ref:'C-09', name:'Peptide de recherche C-09', category:'Peptidomimétique', format:'Lyophilisat · fiole 10 mg', purity:'≥ 99%', price:12800, stock:9, low:4, desc:'Haute pureté vérifiée. Emballage isotherme et suivi d’expédition.' },
    ];
    const insert = db.prepare(`INSERT INTO products(ref,name,category,format,purity,description,price_cents,stock,low_stock,active)
                               VALUES(@ref,@name,@category,@format,@purity,@desc,@price,@stock,@low,1)`);
    for (const p of products) insert.run(p);
    if (log) console.log(`✔ ${products.length} produits ajoutés.`);
  } else if (log) console.log('• Catalogue déjà peuplé.');
}

// Exécution directe : `npm run seed`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed({ log: true });
  console.log('Seed terminé.');
}
