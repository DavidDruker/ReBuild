import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { db } from './database.js';

const app = express();
const port = Number(process.env.PORT || 3001);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const listingSelect = `SELECT l.id, l.type, l.title, l.quantity, l.unit, l.condition,
  l.unit_price AS price, l.available_from AS availableFrom, l.remove_by AS removeBy,
  l.notes, l.image, l.status, l.model, l.dimensions, l.material,
  l.building_types AS buildingTypes, l.weight_kg AS weightKg,
  p.name AS project, p.location, c.name AS company, c.initials, c.verified
  FROM listings l JOIN projects p ON p.id = l.project_id JOIN companies c ON c.id = p.company_id`;

const required = (body, fields) => {
  const missing = fields.filter(field => body[field] === undefined || body[field] === '');
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);
};

function findOrCreateProject(companyName, projectName, location) {
  let company = db.prepare('SELECT id FROM companies WHERE name = ?').get(companyName);
  if (!company) {
    const initials = companyName.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase() || 'CO';
    company = { id: db.prepare('INSERT INTO companies (name, initials) VALUES (?, ?)').run(companyName, initials).lastInsertRowid };
  }
  let project = db.prepare('SELECT id FROM projects WHERE company_id = ? AND name = ?').get(company.id, projectName);
  if (!project) project = { id: db.prepare('INSERT INTO projects (company_id, name, location) VALUES (?, ?, ?)').run(company.id, projectName, location).lastInsertRowid };
  return project.id;
}

function normalize(value = '') { return String(value).toLowerCase().replace(/[×*]/g, 'x').replace(/[^a-z0-9]+/g, ' ').trim(); }
function levenshtein(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a.length) return b.length; if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temporary = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temporary;
    }
  }
  return row[b.length];
}
function editSimilarity(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, 1 - levenshtein(a, b) / Math.max(normalize(a).length, normalize(b).length, 1));
}
const synonymGroups = [
  ['door','doors','entry','entrance','fire rated'], ['wood','timber','lumber','oak','pine','fir','maple'],
  ['tile','floor','flooring','paver','pavers'], ['window','windows','glazing','glass'],
  ['office','commercial','workplace'], ['school','education','classroom','institutional'],
  ['home','housing','residential','apartment','condominium'], ['lamp','light','lighting','led','fixture'],
  ['steel','metal','aluminum','galvanized'], ['clinic','medical','healthcare','hospital']
];
function expandedTokens(value) {
  const tokens = new Set(normalize(value).split(' ').filter(Boolean));
  for (const group of synonymGroups) if (group.some(term => tokens.has(term))) group.forEach(term => tokens.add(term));
  return tokens;
}
function semanticSimilarity(query, text) {
  if (!query) return 0;
  const left = expandedTokens(query); const right = expandedTokens(text);
  const intersection = [...left].filter(token => right.has(token)).length;
  return intersection / Math.max(Math.sqrt(left.size * right.size), 1);
}
function attributeSimilarity(query, listing) {
  const fields = ['model','dimensions','material','buildingType'];
  const scores = fields.filter(field => query[field]).map(field => {
    const target = field === 'buildingType' ? listing.buildingTypes : listing[field];
    return Math.max(editSimilarity(query[field], target), semanticSimilarity(query[field], target));
  });
  return scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
}
function scoreListing(query, listing) {
  const hasSearch = Object.values(query).some(Boolean);
  if (!hasSearch) return { score: 0, edit: 0, semantic: 0, attributes: 0 };
  const searchable = `${listing.title} ${listing.type} ${listing.model} ${listing.material} ${listing.dimensions} ${listing.buildingTypes} ${listing.notes}`;
  const typed = [query.q, query.model, query.dimensions, query.material, query.buildingType].filter(Boolean).join(' ');
  const edit = Math.max(editSimilarity(query.q, listing.title), editSimilarity(query.model, listing.model));
  const semantic = semanticSimilarity(typed, searchable);
  const attributes = attributeSimilarity(query, listing);
  return { score: Math.round((edit * .3 + semantic * .3 + attributes * .4) * 100), edit: Math.round(edit * 100), semantic: Math.round(semantic * 100), attributes: Math.round(attributes * 100) };
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: 'sqlite', payments: 'simulation' }));

app.get('/api/listings', (req, res) => {
  const rows = db.prepare(`${listingSelect} WHERE l.status = 'published'`).all();
  const query = { q:req.query.q || '', model:req.query.model || '', dimensions:req.query.dimensions || '', material:req.query.material || '', buildingType:req.query.buildingType || '' };
  const type = req.query.type;
  const scored = rows.filter(row => !type || type === 'all' || row.type === type).map(row => ({ ...row, match: scoreListing(query, row) }));
  scored.sort((a, b) => Object.values(query).some(Boolean) ? b.match.score - a.match.score || a.price - b.price : b.id - a.id);
  res.json(scored);
});

app.get('/api/listings/:id', (req, res) => {
  const listing = db.prepare(`${listingSelect} WHERE l.id = ?`).get(Number(req.params.id));
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json(listing);
});

app.post('/api/listings', (req, res) => {
  try {
    required(req.body, ['company','project','location','type','title','quantity','unit','condition','availableFrom','removeBy','model','dimensions','material','buildingTypes']);
    const projectId = findOrCreateProject(req.body.company, req.body.project, req.body.location);
    const result = db.prepare(`INSERT INTO listings (project_id,type,title,quantity,unit,condition,unit_price,available_from,remove_by,notes,image,model,dimensions,material,building_types,weight_kg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(projectId, req.body.type.toLowerCase(), req.body.title, Number(req.body.quantity), req.body.unit, req.body.condition, Number(req.body.price || 0), req.body.availableFrom, req.body.removeBy, req.body.notes || '', req.body.image || './assets/reclaimed-warehouse.jpg', req.body.model, req.body.dimensions, req.body.material, req.body.buildingTypes, Number(req.body.weightKg || 0));
    res.status(201).json(db.prepare(`${listingSelect} WHERE l.id = ?`).get(result.lastInsertRowid));
  } catch (error) { res.status(400).json({ error:error.message }); }
});

app.get('/api/demands', (_req, res) => res.json(db.prepare(`SELECT d.*,p.name AS project,p.location,c.name AS company FROM demands d JOIN projects p ON p.id=d.project_id JOIN companies c ON c.id=p.company_id ORDER BY d.created_at DESC`).all()));
app.post('/api/demands', (req, res) => {
  try {
    required(req.body, ['company','project','location','type','title','quantity','unit','neededFrom','needBy','dimensions','material','buildingType']);
    const projectId = findOrCreateProject(req.body.company, req.body.project, req.body.location);
    const result = db.prepare(`INSERT INTO demands (project_id,type,title,quantity,unit,max_unit_price,needed_from,need_by,notes,model,dimensions,material,building_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(projectId, req.body.type.toLowerCase(), req.body.title, Number(req.body.quantity), req.body.unit, req.body.price ? Number(req.body.price) : null, req.body.neededFrom, req.body.needBy, req.body.notes || '', req.body.model || '', req.body.dimensions, req.body.material, req.body.buildingType);
    res.status(201).json({ id:Number(result.lastInsertRowid), ...req.body, status:'open' });
  } catch (error) { res.status(400).json({ error:error.message }); }
});

app.post('/api/checkout/simulate', (req, res) => {
  try {
    required(req.body, ['listingId','quantity','buyerCompany','cardNumber']);
    const listing = db.prepare(`${listingSelect} WHERE l.id = ?`).get(Number(req.body.listingId));
    if (!listing) return res.status(404).json({ error:'Listing not found' });
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > listing.quantity) return res.status(400).json({ error:'Invalid purchase quantity' });
    const digits = String(req.body.cardNumber).replace(/\D/g, '');
    if (digits.length < 12) return res.status(400).json({ error:'Use a valid test card number such as 4242 4242 4242 4242' });
    if (digits === '4000000000000002') return res.status(402).json({ error:'Your simulated card was declined.' });
    const intent = `pi_sim_${crypto.randomBytes(8).toString('hex')}`;
    const amountCents = Math.round(listing.price * quantity * 100);
    const order = db.prepare('INSERT INTO orders (listing_id,buyer_company,quantity,amount_cents,payment_intent,card_last4) VALUES (?,?,?,?,?,?)').run(listing.id, req.body.buyerCompany, quantity, amountCents, intent, digits.slice(-4));
    res.status(201).json({ orderId:Number(order.lastInsertRowid), paymentIntent:intent, amount:amountCents / 100, currency:'CAD', last4:digits.slice(-4), status:'paid_simulation', receipt:`RB-${String(order.lastInsertRowid).padStart(6,'0')}` });
  } catch (error) { res.status(400).json({ error:error.message }); }
});

app.get('/api/orders', (_req, res) => res.json(db.prepare(`SELECT o.*,l.title FROM orders o JOIN listings l ON l.id=o.listing_id ORDER BY o.created_at DESC`).all()));
app.get('/api/summary', (_req, res) => {
  const supply = db.prepare(`SELECT COUNT(*) AS listings,COALESCE(SUM(quantity),0) AS units,COALESCE(SUM(quantity*unit_price),0) AS value FROM listings WHERE status='published'`).get();
  const demand = db.prepare(`SELECT COUNT(*) AS demands FROM demands WHERE status='open'`).get();
  const orders = db.prepare(`SELECT COUNT(*) AS orders,COALESCE(SUM(amount_cents),0)/100.0 AS simulatedRevenue FROM orders`).get();
  res.json({ ...supply, ...demand, ...orders });
});

app.listen(port, '0.0.0.0', () => console.log(`ReBuild API running on port ${port}`));
