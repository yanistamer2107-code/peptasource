// Données de démonstration (comptes labos, commandes) — pour visualiser l'admin
import bcrypt from 'bcryptjs';
import db from './db.js';

function ensureLab(email, data, status){
  let u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u){
    db.prepare(`INSERT INTO users(email,password_hash,role,contact_name,lab_name,accreditation,country,phone,status)
                VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(email, bcrypt.hashSync('secret123',10),'lab',data.contact,data.lab,data.acc,data.country,data.phone,status);
    u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  }
  return u;
}

function placeOrder(userId, items, method, status){
  let total=0; const resolved=[];
  for(const it of items){
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(it.id);
    if(!p || p.stock < it.qty) continue;
    total += p.price_cents*it.qty; resolved.push({p,qty:it.qty});
  }
  const year = new Date().getFullYear();
  const seq = (db.prepare('SELECT COUNT(*) c FROM orders').get().c + 1).toString().padStart(6,'0');
  const ref = `PS-${year}-${seq}`;
  const info = db.prepare(`INSERT INTO orders(reference,user_id,total_cents,payment_method,status) VALUES(?,?,?,?,?)`)
    .run(ref, userId, total, method, status);
  const oid = info.lastInsertRowid;
  const add = db.prepare(`INSERT INTO order_items(order_id,product_id,ref,name,unit_cents,qty) VALUES(?,?,?,?,?,?)`);
  const dec = db.prepare('UPDATE products SET stock=stock-? WHERE id=?');
  for(const {p,qty} of resolved){ add.run(oid,p.id,p.ref,p.name,p.price_cents,qty); dec.run(qty,p.id); }
  return ref;
}

const lab1 = ensureLab('biolab@inserm.fr', {contact:'Dr. Lemaire', lab:'BioLab Inserm U1234', acc:'FR-INS-8842', country:'France', phone:'+33 1 23 45 67 89'}, 'approved');
ensureLab('contact@genetec.fr', {contact:'Dr. Fontaine', lab:'GeneTec Research', acc:'FR-GEN-3391', country:'France', phone:'+33 4 56 78 90 12'}, 'pending');
ensureLab('lab@meduni.at', {contact:'Prof. Bauer', lab:'MedUni Wien', acc:'AT-MUW-1120', country:'Autriche', phone:'+43 1 40160'}, 'pending');

if(db.prepare('SELECT COUNT(*) c FROM orders').get().c === 0){
  placeOrder(lab1.id, [{id:5,qty:2},{id:6,qty:1}], 'virement', 'paid');
  placeOrder(lab1.id, [{id:1,qty:4}], 'crypto', 'awaiting_payment');
  placeOrder(lab1.id, [{id:2,qty:1}], 'virement', 'shipped');
}
console.log('✔ Démo prête.');
