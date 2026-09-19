import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, BadgeCheck, Bell, Building2, CalendarDays, ChartNoAxesCombined,
  Check, ChevronDown, ChevronsUpDown, CircleCheck, ClipboardList, ClipboardPlus,
  CreditCard, Download, FileText, GitCompareArrows, LayoutGrid, Layers3, LogOut,
  MapPin, Menu, Package, PackageCheck, PackageOpen, PackagePlus, ReceiptText,
  Scale, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Truck,
  UserRound, WalletCards, X
} from 'lucide-react';
import './styles.css';

const categories = ['all','doors','lumber','flooring','fixtures','windows','steel','brick','partitions','roofing'];
const initialFilters = { model:'', dimensions:'', material:'', buildingType:'' };
const navItems = [
  ['marketplace', LayoutGrid, 'Marketplace'], ['matches', GitCompareArrows, 'Smart matches'],
  ['supply', PackageOpen, 'Supply'], ['demand', ClipboardList, 'Demand'],
  ['logistics', Truck, 'Logistics'], ['impact', ChartNoAxesCombined, 'Impact']
];

async function api(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}

function Sidebar({ view, setView, open, close }) {
  const navigate = target => { setView(target); close(); };
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <a className="brand" href="#" onClick={event => { event.preventDefault(); navigate('marketplace'); }}><span className="brand-mark"><img src="./assets/rebuild-mark.png" alt="" /></span><span>Re<span>Build</span></span></a>
    <nav className="primary-nav">{navItems.map(([id, Icon, label]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon /><span>{label}</span>{id === 'matches' && <b>3</b>}</button>)}</nav>
    <div className="sidebar-foot"><button className="org-switcher" onClick={() => navigate('settings')}><span className="org-logo">NB</span><span><strong>Northbuild</strong><small>Enterprise workspace</small></span><ChevronsUpDown /></button><button className={`nav-item muted ${view === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings /><span>Settings</span></button></div>
  </aside>;
}

function Topbar({ query, setQuery, toggleMenu, notify }) {
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  useEffect(() => { const handler = event => { if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); document.querySelector('#globalSearch')?.focus(); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  return <header className="topbar">
    <button className="icon-button menu-button" onClick={toggleMenu}><Menu /></button>
    <div className="top-search"><Search /><input id="globalSearch" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, model, size or material" /><kbd>/</kbd></div>
    <div className="top-actions">
      <div className="popover-wrap"><button className="icon-button" onClick={() => setNotifications(value => !value)}><Bell /><span className="notification-dot" /></button>{notifications && <div className="popover notification-popover"><strong>Notifications</strong><button onClick={() => notify('Match RB-204 is ready to review.')}>94% match found for fire doors<small>2 minutes ago</small></button><button onClick={() => notify('Pickup reminder acknowledged.')}>Pickup scheduled for Oct 14<small>1 hour ago</small></button></div>}</div>
      <div className="popover-wrap"><button className="user-button" onClick={() => setProfile(value => !value)}><span>AC</span><span className="user-copy"><strong>Alex Chen</strong><small>Project manager</small></span><ChevronDown /></button>{profile && <div className="popover profile-popover"><button onClick={() => notify('Profile settings opened in demo mode.')}><UserRound /> Profile</button><button onClick={() => notify('Signed out simulation complete.')}><LogOut /> Sign out</button></div>}</div>
    </div>
  </header>;
}

function PageHeading({ eyebrow, title, copy, children }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div>{children && <div className="heading-actions">{children}</div>}</div>; }
function Summary({ icon:Icon, tone, value, label }) { return <div><span className={`summary-icon ${tone}`}><Icon /></span><p><strong>{value}</strong><small>{label}</small></p></div>; }
function Stats({ items }) { return <div className="stat-grid">{items.map(([label,value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }

function MaterialCard({ item, openDetail, buy }) {
  const score = item.match?.score || 0;
  return <article className="material-card">
    <div className="material-photo"><img src={item.image} alt={item.title} /><span className="material-badge">{item.condition}</span>{score > 0 && <span className="match-badge"><Sparkles /> {score}% match</span>}</div>
    <div className="material-body"><div className="material-top"><h3>{item.title}</h3><strong>${item.price}<small> / {item.unit}</small></strong></div><p className="material-project">{item.project}</p>
      <div className="spec-list"><span><b>Model</b>{item.model}</span><span><b>Size</b>{item.dimensions}</span><span><b>Material</b>{item.material}</span></div>
      <div className="material-meta"><span><Package />{Number(item.quantity).toLocaleString()} {item.unit}</span><span><MapPin />{item.location}</span><span><CalendarDays />By {item.removeBy}</span><span><ShieldCheck />{item.verified ? 'Verified supplier' : 'Documented'}</span></div>
      {score > 0 && <div className="score-breakdown"><span>Edit {item.match.edit}%</span><span>Semantic {item.match.semantic}%</span><span>Specs {item.match.attributes}%</span></div>}
      <div className="card-footer"><span className="company-tag"><i>{item.initials}</i>{item.company}</span><div className="card-actions"><button className="text-link" onClick={() => openDetail(item)}>Details</button><button className="mini-buy" onClick={() => buy(item)}><CreditCard /> Buy</button></div></div>
    </div>
  </article>;
}

function SearchPanel({ filters, setFilters, apply, clear }) {
  const update = event => setFilters({ ...filters, [event.target.name]:event.target.value });
  return <section className="advanced-search"><div className="advanced-title"><span><SlidersHorizontal /> Specification filters</span><small>Ranked by edit distance, semantic similarity and technical attributes</small></div><div className="advanced-grid"><label>Model number<input name="model" value={filters.model} onChange={update} placeholder="e.g. FD90-OAK-900" /></label><label>Dimensions<input name="dimensions" value={filters.dimensions} onChange={update} placeholder="e.g. 900 x 2100 mm" /></label><label>Material<input name="material" value={filters.material} onChange={update} placeholder="e.g. solid oak" /></label><label>Building type<select name="buildingType" value={filters.buildingType} onChange={update}><option value="">Any building</option><option>Residential</option><option>Office</option><option>School</option><option>Healthcare</option><option>Retail</option><option>Industrial</option><option>Restaurant</option><option>Community</option></select></label></div><div className="advanced-actions"><button className="button ghost" onClick={clear}>Clear</button><button className="button primary" onClick={apply}><Search /> Find compatible materials</button></div></section>;
}

function Marketplace({ query, materials, loading, category, setCategory, filters, setFilters, search, clear, openModal, openDetail, buy }) {
  const [advanced, setAdvanced] = useState(false);
  return <><PageHeading eyebrow="Circular inventory network" title="Available materials" copy="Search verified surplus by model, dimensions, material and intended building use."><button className="button secondary" onClick={() => openModal('demand')}><ClipboardPlus /> Post demand</button><button className="button primary" onClick={() => openModal('supply')}><PackagePlus /> List supply</button></PageHeading>
    <section className="summary-strip"><Summary icon={PackageCheck} tone="green" value={materials.length.toLocaleString()} label="Matching listings" /><Summary icon={Building2} tone="amber" value="9" label="Building categories" /><Summary icon={GitCompareArrows} tone="blue" value="Hybrid" label="Match engine" /><Summary icon={Scale} tone="charcoal" value="186 t" label="Potential diversion" /></section>
    <div className="filters">{categories.map(type => <button key={type} className={`filter-button ${category === type ? 'active' : ''}`} onClick={() => setCategory(type)}>{type === 'all' && <Layers3 />}{type === 'all' ? 'All materials' : type[0].toUpperCase()+type.slice(1)}</button>)}<button className={`filter-button icon-only ${advanced ? 'active' : ''}`} onClick={() => setAdvanced(value => !value)}><SlidersHorizontal /></button></div>
    {advanced && <SearchPanel filters={filters} setFilters={setFilters} apply={search} clear={clear} />}
    <div className="listing-grid wide">{loading && <div className="empty-state"><PackageOpen /><h2>Searching inventory</h2><p>Calculating compatibility scores...</p></div>}{!loading && materials.map(item => <MaterialCard key={item.id} item={item} openDetail={openDetail} buy={buy} />)}{!loading && !materials.length && <div className="empty-state"><Search /><h2>No compatible inventory</h2><p>Broaden the dimensions or material description and try again.</p></div>}</div>
  </>;
}

function DetailModal({ item, close, buy }) {
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="modal detail-modal"><div className="detail-image"><img src={item.image} alt={item.title} /></div><div className="modal-header"><div><p className="eyebrow">Material passport · {item.model}</p><h2>{item.title}</h2></div><button className="icon-button" onClick={close}><X /></button></div><div className="detail-content"><div className="detail-specs"><span><small>Dimensions</small><strong>{item.dimensions}</strong></span><span><small>Material</small><strong>{item.material}</strong></span><span><small>Available</small><strong>{item.quantity} {item.unit}</strong></span><span><small>Building use</small><strong>{item.buildingTypes}</strong></span></div><p>{item.notes || 'No additional handling notes.'}</p><div className="verified-note"><BadgeCheck /><p><strong>{item.company}</strong><small>{item.project} · {item.location}</small></p></div></div><div className="modal-actions"><button className="button secondary" onClick={close}>Close</button><button className="button primary" onClick={() => buy(item)}><CreditCard /> Purchase material</button></div></section></div>;
}

function CheckoutModal({ item, close, complete }) {
  const [quantity, setQuantity] = useState(1); const [processing, setProcessing] = useState(false); const [error, setError] = useState('');
  const total = Number(item.price) * Number(quantity || 0);
  const submit = async event => { event.preventDefault(); setProcessing(true); setError(''); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await complete({ ...values, listingId:item.id, quantity:Number(quantity) }); } catch (problem) { setError(problem.message); setProcessing(false); } };
  return <div className="modal-backdrop"><section className="modal checkout-modal"><div className="modal-header"><div><p className="eyebrow">Stripe-style test checkout</p><h2>Complete simulated payment</h2></div><button className="icon-button" onClick={close}><X /></button></div><div className="demo-banner"><ShieldCheck /><span><strong>Simulation only</strong>No real Stripe request or charge will occur. Use test card 4242 4242 4242 4242.</span></div><form onSubmit={submit}><div className="checkout-product"><img src={item.image} alt="" /><span><strong>{item.title}</strong><small>{item.model} · ${item.price}/{item.unit}</small></span></div><div className="form-grid"><label className="full-field">Buyer company<input name="buyerCompany" required defaultValue="Northbuild" /></label><label>Quantity<input type="number" min="1" max={item.quantity} value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><label>Total (CAD)<input value={`$${total.toFixed(2)}`} readOnly /></label><label className="full-field">Card number<div className="input-with-icon"><CreditCard /><input name="cardNumber" required defaultValue="4242 4242 4242 4242" inputMode="numeric" /></div></label><label>Expiry<input name="expiry" required defaultValue="12/30" /></label><label>CVC<input name="cvc" required defaultValue="123" /></label></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button stripe-button" disabled={processing}><WalletCards /> {processing ? 'Processing...' : `Pay $${total.toFixed(2)} CAD`}</button></div></form></section></div>;
}

function ReceiptModal({ receipt, close }) { return <div className="modal-backdrop"><section className="modal receipt-modal"><div className="success-mark"><Check /></div><p className="eyebrow">Payment simulation successful</p><h2>{receipt.receipt}</h2><p>No funds were transferred. A simulated order was saved to SQLite.</p><div className="receipt-lines"><span>Amount<strong>${receipt.amount.toFixed(2)} CAD</strong></span><span>Test card<strong>•••• {receipt.last4}</strong></span><span>Status<strong>Paid · simulation</strong></span></div><button className="button primary full" onClick={close}>Return to marketplace</button></section></div>; }

function ListingModal({ mode, close, submit }) {
  const demand = mode === 'demand';
  const handleSubmit = event => { event.preventDefault(); submit(Object.fromEntries(new FormData(event.currentTarget))); };
  return <div className="modal-backdrop"><section className="modal"><div className="modal-header"><div><p className="eyebrow">{demand ? 'New requirement' : 'New inventory'}</p><h2>{demand ? 'Post material demand' : 'List surplus material'}</h2></div><button className="icon-button" onClick={close}><X /></button></div><form onSubmit={handleSubmit}><div className="form-grid listing-form"><label>Company<input name="company" required defaultValue="Northbuild" /></label><label>Project<input name="project" required defaultValue={demand ? 'Scarborough Housing' : 'King Street Retrofit'} /></label><label className="full-field">Listing title<input name="title" required placeholder="Fire-rated oak doors" /></label><label>Category<select name="type">{categories.slice(1).map(type => <option key={type}>{type}</option>)}</select></label><label>Model number<input name="model" required={!demand} placeholder="FD90-OAK-900" /></label><label>Dimensions<input name="dimensions" required placeholder="900 x 2100 x 45 mm" /></label><label>Material<input name="material" required placeholder="Solid oak" /></label><label>{demand ? 'Building type' : 'Compatible buildings'}<input name={demand ? 'buildingType' : 'buildingTypes'} required placeholder="Office, Residential" /></label><label>Quantity<input name="quantity" type="number" min="1" required /></label><label>Unit<select name="unit"><option>units</option><option>sq ft</option><option>board ft</option><option>linear ft</option><option>panels</option></select></label><label>Condition<select name="condition"><option>Unused</option><option>Excellent</option><option>Good</option><option>Needs refurbishment</option></select></label><label>Unit price<input name="price" type="number" min="0" step=".01" /></label><label className="full-field">Location<input name="location" required defaultValue="Toronto, ON" /></label><label>{demand ? 'Needed from' : 'Available from'}<input name={demand ? 'neededFrom' : 'availableFrom'} type="date" required defaultValue="2026-10-14" /></label><label>{demand ? 'Need by' : 'Remove by'}<input name={demand ? 'needBy' : 'removeBy'} type="date" required defaultValue="2026-11-15" /></label><label className="full-field">Notes<textarea name="notes" rows="3" /></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancel</button><button className="button primary">Publish to ReBuild <ArrowRight /></button></div></form></section></div>;
}

function DataTable({ headers, rows }) { return <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={index}>{row.map((cell,cellIndex) => <td key={cellIndex}>{cellIndex === row.length-1 ? <span className="status">{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div>; }

function DataPage({ type, materials, demands, openModal, notify, exportCsv }) {
  if (type === 'matches') return <div className="subpage"><PageHeading eyebrow="Hybrid compatibility engine" title="Smart matches" copy="Ranking combines normalized edit distance, local semantic token similarity, and exact specification fields." /><Stats items={[["Indexed materials",materials.length],["Highest score",`${Math.max(...materials.map(item => item.match?.score || 0),0)}%`],["Scoring signals","3"]]} /><DataTable headers={['Material','Model','Dimensions','Building use','Score']} rows={materials.slice(0,10).map(item => [item.title,item.model,item.dimensions,item.buildingTypes,`${item.match?.score || 0}% match`])} /></div>;
  if (type === 'supply') return <div className="subpage"><PageHeading eyebrow="Supplier workspace" title="Surplus supply" copy="Database-backed inventory from current deconstruction projects."><button className="button primary" onClick={() => openModal('supply')}><PackagePlus /> List supply</button></PageHeading><Stats items={[["Active listings",materials.length],["Verified","92%"],["Inventory value",`$${materials.reduce((sum,item) => sum + item.price*item.quantity,0).toLocaleString(undefined,{maximumFractionDigits:0})}`]]} /><DataTable headers={['Material','Model','Project','Quantity','Status']} rows={materials.slice(0,15).map(item => [item.title,item.model,item.project,`${item.quantity} ${item.unit}`,'Published'])} /></div>;
  if (type === 'demand') return <div className="subpage"><PageHeading eyebrow="Buyer workspace" title="Project demand" copy="Requirements stored in SQLite and ready for compatibility matching."><button className="button primary" onClick={() => openModal('demand')}><ClipboardPlus /> Post demand</button></PageHeading><Stats items={[["Open requests",demands.length],["Projects",new Set(demands.map(item => item.project)).size],["Status","Live"]]} />{demands.length ? <DataTable headers={['Requirement','Project','Dimensions','Material','Status']} rows={demands.map(item => [item.title,item.project,item.dimensions,item.material,'Open'])} /> : <Empty title="No demand records" copy="Post the first project requirement." />}</div>;
  if (type === 'logistics') return <div className="subpage"><PageHeading eyebrow="Circular logistics" title="Transfer routes" copy="Coordinate pickup windows with available return trips." /><Stats items={[["Scheduled transfers","6"],["Empty km avoided","318"],["Load utilization","82%"]]} />{[['King Street → Scarborough','200 doors · Oct 14, 09:30','4 km detour'],['Harbourfront → Parkdale','Douglas fir · Oct 18, 14:00','7 km detour'],['Midtown → East York','48 windows · Oct 21, 08:00','Shared load']].map(route => <div className="route-card" key={route[0]}><span><Truck /></span><p><strong>{route[0]}</strong><small>{route[1]}</small></p><button className="status" onClick={() => notify(`Route confirmed: ${route[0]}`)}>{route[2]}</button></div>)}</div>;
  if (type === 'settings') return <SettingsPage notify={notify} />;
  return <div className="subpage"><PageHeading eyebrow="Verified outcomes" title="Impact dashboard" copy="Financial and environmental value retained across projects."><button className="button secondary" onClick={exportCsv}><Download /> Export CSV</button></PageHeading><Stats items={[["Waste diverted","186.4 t"],["Value recovered","$284,900"],["Estimated CO₂e avoided","73.1 t"]]} /><h2>Monthly material diversion</h2><div className="impact-chart">{[['31%','May'],['46%','Jun'],['40%','Jul'],['65%','Aug'],['74%','Sep'],['92%','Oct']].map(([height,label]) => <div key={label} style={{'--bar':height}} data-label={label} />)}</div></div>;
}

function Empty({ title, copy }) { return <div className="empty-state"><FileText /><h2>{title}</h2><p>{copy}</p></div>; }
function SettingsPage({ notify }) { const [email,setEmail] = useState(true); const [auto,setAuto] = useState(false); return <div className="subpage"><PageHeading eyebrow="Workspace controls" title="Settings" copy="Manage demo preferences for the Northbuild workspace." /><div className="settings-list"><label><span><strong>Email match alerts</strong><small>Receive a notice when compatibility exceeds 80%.</small></span><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /></label><label><span><strong>Automatic reservations</strong><small>Reserve exact model matches for 24 hours.</small></span><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /></label><label><span><strong>Default search radius</strong><small>Maximum distance used for logistics matching.</small></span><select><option>25 km</option><option>50 km</option><option>100 km</option></select></label></div><button className="button primary" onClick={() => notify('Workspace settings saved.')}>Save settings</button></div>; }

function App() {
  const [view,setView] = useState('marketplace'); const [query,setQuery] = useState(''); const [category,setCategory] = useState('all'); const [filters,setFilters] = useState(initialFilters); const [applied,setApplied] = useState(initialFilters); const [materials,setMaterials] = useState([]); const [demands,setDemands] = useState([]); const [loading,setLoading] = useState(true); const [menu,setMenu] = useState(false); const [modal,setModal] = useState(null); const [detail,setDetail] = useState(null); const [checkout,setCheckout] = useState(null); const [receipt,setReceipt] = useState(null); const [toast,setToast] = useState('');
  const notify = message => { setToast(message); window.clearTimeout(window.__rebuildToast); window.__rebuildToast = window.setTimeout(() => setToast(''),3000); };
  const searchParams = useMemo(() => ({ q:query, type:category, ...applied }), [query,category,applied]);
  const load = async () => { setLoading(true); try { const params = new URLSearchParams(Object.entries(searchParams).filter(([,value]) => value)); const [list,demandList] = await Promise.all([api(`/api/listings?${params}`),api('/api/demands')]); setMaterials(list); setDemands(demandList); } catch (error) { notify(error.message); } finally { setLoading(false); } };
  useEffect(() => { const timer = setTimeout(load,250); return () => clearTimeout(timer); }, [searchParams]);
  const publish = async payload => { const endpoint = modal === 'demand' ? '/api/demands' : '/api/listings'; try { await api(endpoint,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) }); setModal(null); notify('Saved to the ReBuild database.'); load(); } catch (error) { notify(error.message); } };
  const beginBuy = item => { setDetail(null); setCheckout(item); };
  const completeCheckout = async payload => { const result = await api('/api/checkout/simulate',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload) }); setCheckout(null); setReceipt(result); };
  const exportCsv = () => { const rows = [['Title','Model','Dimensions','Material','Quantity','Price'],...materials.map(item => [item.title,item.model,item.dimensions,item.material,item.quantity,item.price])]; const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n'); const link = document.createElement('a'); link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); link.download='rebuild-impact-inventory.csv'; link.click(); URL.revokeObjectURL(link.href); notify('CSV report downloaded.'); };
  return <div className="app-shell"><Sidebar view={view} setView={setView} open={menu} close={() => setMenu(false)} /><main><Topbar query={query} setQuery={setQuery} toggleMenu={() => setMenu(value => !value)} notify={notify} /><section className="workspace">{view === 'marketplace' ? <Marketplace query={query} materials={materials} loading={loading} category={category} setCategory={setCategory} filters={filters} setFilters={setFilters} search={() => setApplied(filters)} clear={() => { setFilters(initialFilters); setApplied(initialFilters); }} openModal={setModal} openDetail={setDetail} buy={beginBuy} /> : <DataPage type={view} materials={materials} demands={demands} openModal={setModal} notify={notify} exportCsv={exportCsv} />}</section></main>{modal && <ListingModal mode={modal} close={() => setModal(null)} submit={publish} />}{detail && <DetailModal item={detail} close={() => setDetail(null)} buy={beginBuy} />}{checkout && <CheckoutModal item={checkout} close={() => setCheckout(null)} complete={completeCheckout} />}{receipt && <ReceiptModal receipt={receipt} close={() => setReceipt(null)} />}<div className={`toast ${toast ? 'show' : ''}`}><CircleCheck /><span>{toast}</span></div></div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
