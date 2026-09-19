import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(here, '..', 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new DatabaseSync(path.join(dataDirectory, 'rebuild.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    initials TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    condition TEXT NOT NULL,
    unit_price REAL NOT NULL DEFAULT 0 CHECK(unit_price >= 0),
    available_from TEXT NOT NULL,
    remove_by TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT './assets/reclaimed-warehouse.jpg',
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS demands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    unit TEXT NOT NULL,
    max_unit_price REAL,
    needed_from TEXT NOT NULL,
    need_by TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id),
    buyer_company TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity > 0),
    amount_cents INTEGER NOT NULL,
    payment_intent TEXT NOT NULL UNIQUE,
    card_last4 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid_simulation',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(column => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn('listings', 'model', "TEXT NOT NULL DEFAULT ''");
ensureColumn('listings', 'dimensions', "TEXT NOT NULL DEFAULT ''");
ensureColumn('listings', 'material', "TEXT NOT NULL DEFAULT ''");
ensureColumn('listings', 'building_types', "TEXT NOT NULL DEFAULT ''");
ensureColumn('listings', 'weight_kg', 'REAL NOT NULL DEFAULT 0');
ensureColumn('demands', 'model', "TEXT NOT NULL DEFAULT ''");
ensureColumn('demands', 'dimensions', "TEXT NOT NULL DEFAULT ''");
ensureColumn('demands', 'material', "TEXT NOT NULL DEFAULT ''");
ensureColumn('demands', 'building_type', "TEXT NOT NULL DEFAULT ''");

const addCompany = db.prepare('INSERT OR IGNORE INTO companies (name, initials, verified) VALUES (?, ?, 1)');
const findCompany = db.prepare('SELECT id FROM companies WHERE name = ?');
const addProject = db.prepare('INSERT INTO projects (company_id, name, location, latitude, longitude) VALUES (?, ?, ?, ?, ?)');
const findProject = db.prepare('SELECT id FROM projects WHERE company_id = ? AND name = ?');
const listingExists = db.prepare('SELECT id FROM listings WHERE title = ? AND project_id = ?');
const refreshListing = db.prepare(`UPDATE listings SET type=?,quantity=?,unit=?,condition=?,unit_price=?,model=?,dimensions=?,material=?,building_types=?,weight_kg=?,notes=? WHERE id=?`);
const addListing = db.prepare(`INSERT INTO listings
  (project_id, type, title, quantity, unit, condition, unit_price, available_from, remove_by, image, model, dimensions, material, building_types, weight_kg, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const imageFor = type => ({ doors:'reclaimed-warehouse.jpg', lumber:'reclaimed-lumber.jpg', flooring:'reclaimed-tile.jpg', fixtures:'reclaimed-fixtures.jpg', windows:'reclaimed-windows.jpg' }[type] || 'reclaimed-warehouse.jpg');

const seedListings = [
  ['Northbuild','NB','King St. Office Retrofit','Toronto, ON','doors','Fire-rated oak doors',200,'units','Excellent',45,'FD90-OAK-900','900 x 2100 x 45 mm','Solid oak','Office, Residential, Institutional',38,'90-minute rating; hardware removed'],
  ['Atlas Demo','AD','Harbour Warehouse Renewal','Toronto, ON','lumber','Reclaimed Douglas fir beams',4800,'board ft','Good',3.2,'DF-LAM-240','240 x 300 x 4800 mm','Douglas fir','Commercial, Community, Residential',92,'De-nailed and moisture tested'],
  ['Civic Form','CF','Union Lobby Upgrade','Toronto, ON','flooring','Porcelain floor tile',860,'sq ft','Unused',2.4,'PT-GR-600','600 x 600 x 10 mm','Porcelain','Office, Retail, Institutional',2.1,'Twenty-four unopened pallets'],
  ['Urban Core','UC','Yonge Tower Decommission','Toronto, ON','fixtures','Commercial LED fixtures',96,'units','Tested',28,'LED-PNL-40W','600 x 600 x 35 mm','Aluminum / polycarbonate','Office, School, Retail',3.4,'4000K, dimmable driver'],
  ['Cedar Works','CW','Midtown School Renewal','Toronto, ON','windows','Aluminum frame windows',48,'units','Good',75,'AW-1215-DBL','1200 x 1500 x 100 mm','Aluminum / double glazing','School, Office, Residential',42,'Thermal break frames'],
  ['Loop Build','LB','Queen West Conversion','Toronto, ON','doors','Solid-core interior doors',64,'units','Good',32,'SC-MPL-850','850 x 2100 x 40 mm','Maple veneer / wood core','Residential, Hotel, Office',31,'Minor hardware marks'],
  ['Metro Salvage','MS','Bloor Hotel Renewal','Toronto, ON','doors','Walnut hotel room doors',118,'units','Excellent',68,'HT-WAL-915','915 x 2030 x 44 mm','Walnut veneer / mineral core','Hotel, Residential',36,'Electronic locks not included'],
  ['TrueNorth Demo','TD','Liberty Village Loft','Toronto, ON','lumber','Reclaimed pine joists',2200,'linear ft','Good',4.8,'PINE-2X10','38 x 235 x 3650 mm','Eastern white pine','Residential, Community',14,'Circa 1920; metal scanned'],
  ['GreenSpan','GS','Danforth Clinic Fit-out','Toronto, ON','fixtures','Stainless steel sinks',22,'units','Excellent',120,'SS-SINK-600','600 x 500 x 220 mm','304 stainless steel','Healthcare, Restaurant, Laboratory',11,'Single bowl with drain assembly'],
  ['Revive Materials','RM','Etobicoke School Wing','Toronto, ON','flooring','Rubber athletic flooring',3200,'sq ft','Good',1.9,'RF-8-BLK','1000 x 1000 x 8 mm','Recycled rubber','School, Gym, Community',7.5,'Interlocking tiles, black fleck'],
  ['BuildLoop','BL','Yorkdale Retail Reset','Toronto, ON','fixtures','Track lighting heads',144,'units','Tested',16,'TL-30-BK','180 x 90 x 70 mm','Powder-coated aluminum','Retail, Gallery, Restaurant',0.8,'3000K, 30W LED'],
  ['Harbour Decon','HD','Lakeshore Condominium','Toronto, ON','windows','Vinyl casement windows',72,'units','Good',95,'VC-9012-LOWE','900 x 1200 x 90 mm','Vinyl / low-E glazing','Residential, Hotel',31,'White frames, operable'],
  ['StoneCycle','SC','Financial District Plaza','Toronto, ON','flooring','Granite pavers',1800,'sq ft','Good',6.5,'GR-PAV-600','600 x 300 x 30 mm','Flamed granite','Landscape, Retail, Civic',14,'Grey, cleaned and palletized'],
  ['Northbuild','NB','Spadina Office Retrofit','Toronto, ON','partitions','Demountable glass partitions',42,'panels','Excellent',185,'DG-PART-10','1000 x 2700 x 10 mm','Tempered glass / aluminum','Office, Institutional',71,'Tracks and clips included'],
  ['Atlas Demo','AD','Port Lands Warehouse','Toronto, ON','steel','Structural steel channels',38,'units','Good',260,'C250-30','250 x 90 x 6000 mm','Galvanized steel','Industrial, Commercial',178,'Engineer review required'],
  ['Civic Form','CF','Annex Library Refresh','Toronto, ON','fixtures','Acoustic ceiling baffles',76,'units','Excellent',42,'AC-BF-1200','1200 x 300 x 40 mm','Recycled PET felt','Office, School, Library',2.6,'NRC 0.85, charcoal'],
  ['Urban Core','UC','Waterfront Restaurant','Toronto, ON','fixtures','Commercial kitchen tables',14,'units','Good',210,'KT-SS-1800','1800 x 700 x 900 mm','304 stainless steel','Restaurant, Laboratory',48,'Adjustable feet'],
  ['Cedar Works','CW','High Park Residence','Toronto, ON','lumber','White oak flooring',1450,'sq ft','Good',5.6,'WO-FLR-19','90 x 900 x 19 mm','White oak','Residential, Hotel, Retail',1.2,'Tongue and groove, de-nailed'],
  ['Loop Build','LB','College Street Apartments','Toronto, ON','fixtures','Bathroom vanities',34,'units','Excellent',155,'VAN-750-WH','750 x 500 x 850 mm','Plywood / quartz','Residential, Hotel',39,'Faucets not included'],
  ['Metro Salvage','MS','Distillery Gallery','Toronto, ON','brick','Heritage clay brick',12500,'units','Good',1.15,'CLAY-STD-1920','215 x 102 x 65 mm','Fired clay','Residential, Heritage, Landscape',2.7,'Cleaned, mixed red tones'],
  ['TrueNorth Demo','TD','Airport Office Annex','Mississauga, ON','flooring','Raised access floor panels',620,'units','Good',18,'RAF-600-ST','600 x 600 x 35 mm','Steel / cement core','Office, Data centre',14,'Pedestals available separately'],
  ['GreenSpan','GS','Scarborough Community Centre','Toronto, ON','roofing','Insulated metal panels',52,'units','Unused',145,'IMP-100-R40','1000 x 6000 x 100 mm','Steel / PIR insulation','Industrial, Community, Commercial',62,'R-40, light grey'],
  ['Revive Materials','RM','North York Lab Upgrade','Toronto, ON','fixtures','Laboratory casework',28,'units','Excellent',320,'LAB-CAB-1200','1200 x 600 x 900 mm','Powder-coated steel','Laboratory, Healthcare, School',54,'Chemical-resistant tops'],
  ['BuildLoop','BL','Roncesvalles Townhomes','Toronto, ON','doors','Fiberglass exterior doors',26,'units','Unused',240,'FG-EXT-914','914 x 2032 x 45 mm','Fiberglass / foam core','Residential, Community',29,'Prehung, right and left swing'],
  ['Harbour Decon','HD','East Harbour Offices','Toronto, ON','ceilings','Mineral fibre ceiling tile',5400,'sq ft','Good',0.95,'MFT-600-A','600 x 600 x 15 mm','Mineral fibre','Office, School, Retail',1.4,'Clean, tegular edge'],
  ['StoneCycle','SC','Casa Loma Service Building','Toronto, ON','stone','Limestone wall panels',88,'units','Good',88,'LIME-PNL-40','900 x 450 x 40 mm','Indiana limestone','Civic, Heritage, Commercial',39,'Anchors removed'],
  ['Northbuild','NB','Queens Quay Residential','Toronto, ON','insulation','Rigid mineral wool boards',180,'units','Unused',24,'MW-R24-100','600 x 1200 x 100 mm','Mineral wool','Residential, Commercial, Industrial',8.5,'R-24, unopened packs'],
  ['Atlas Demo','AD','St. Clair Medical Centre','Toronto, ON','fixtures','Solid surface countertops',19,'units','Good',135,'SS-CT-2400','2400 x 650 x 25 mm','Acrylic solid surface','Healthcare, Laboratory, Office',47,'White, sink cutouts vary'],
  ['Civic Form','CF','Kensington Retail Block','Toronto, ON','windows','Steel storefront frames',16,'units','Good',380,'SF-ST-2430','2400 x 3000 x 100 mm','Painted steel / glass','Retail, Restaurant, Commercial',122,'Frames dismantled in sections'],
  ['Urban Core','UC','U of T Classroom Renewal','Toronto, ON','fixtures','Fixed lecture seating',210,'units','Excellent',55,'LS-500-BL','520 x 760 x 900 mm','Steel / molded plywood','School, Theatre, Civic',18,'Blue upholstery, row hardware included']
];

db.exec('BEGIN');
try {
  for (const row of seedListings) {
    const [companyName, initials, projectName, location, type, title, quantity, unit, condition, price, model, dimensions, material, buildingTypes, weight, notes] = row;
    addCompany.run(companyName, initials);
    const companyId = findCompany.get(companyName).id;
    let project = findProject.get(companyId, projectName);
    if (!project) {
      const result = addProject.run(companyId, projectName, location, 43.6532, -79.3832);
      project = { id: result.lastInsertRowid };
    }
    const existing = listingExists.get(title, project.id);
    if (!existing) {
      addListing.run(project.id, type, title, quantity, unit, condition, price, '2026-10-01', '2026-11-15', `./assets/${imageFor(type)}`, model, dimensions, material, buildingTypes, weight, notes);
    } else refreshListing.run(type, quantity, unit, condition, price, model, dimensions, material, buildingTypes, weight, notes, existing.id);
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

db.exec(`
  UPDATE listings SET model = CASE type
    WHEN 'doors' THEN 'GEN-DOOR-900' WHEN 'lumber' THEN 'GEN-TIMBER'
    WHEN 'flooring' THEN 'GEN-FLOOR' WHEN 'windows' THEN 'GEN-WINDOW'
    ELSE 'GEN-FIXTURE' END WHERE model = '';
  UPDATE listings SET material = CASE type
    WHEN 'doors' THEN 'Wood composite' WHEN 'lumber' THEN 'Reclaimed wood'
    WHEN 'flooring' THEN 'Porcelain' WHEN 'windows' THEN 'Aluminum / glass'
    ELSE 'Mixed material' END WHERE material = '';
  UPDATE listings SET dimensions = 'Specification pending' WHERE dimensions = '';
  UPDATE listings SET building_types = 'Commercial, Residential' WHERE building_types = '';
`);
