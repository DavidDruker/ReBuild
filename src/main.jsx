import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Check,
  CircleCheck,
  ClipboardList,
  LayoutGrid,
  MapPin,
  Menu,
  Package,
  PackageOpen,
  PackagePlus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, storageNotice } from "./store.js";
import { assessVideo } from "./videoAssessment.js";
import {
  categories,
  dateOffset,
  localDate,
  photoFor,
  WORKSPACE,
} from "./model.js";
import "./styles.css";

const money = (value) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);
const titleCase = (value) => value[0].toUpperCase() + value.slice(1);
const imageFor = (item) => photoFor(item.type);
const statuses = {
  requested: "Pending",
  accepted: "Accepted",
  ready: "Accepted",
  collected: "Completed",
  cancelled: "Cancelled",
};
const nextStatus = {
  requested: "accepted",
};
const actionLabels = {
  accepted: "Accept request",
};
const initialFilters = { type: "" };
// [id, icon, sidebar label, bottom-tab label]
const navItems = [
  ["marketplace", LayoutGrid, "Marketplace", "Market"],
  ["mine", Package, "My listings", "Listings"],
  ["listing", PackagePlus, "List material", "List"],
  ["activity", ClipboardList, "Activity", "Activity"],
];

function Sidebar({ view, navigate, open, close, reset, listMaterial, menuRef }) {
  const panel = useRef(null);
  const closeRef = useRef(null);
  const wasOpen = useRef(false);
  // The drawer behaves as a modal layer on narrow screens: move focus into it
  // on open, keep Tab inside it, and hand focus back to its trigger on close.
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) menuRef?.current?.focus();
    wasOpen.current = open;
  }, [open, menuRef]);
  useEffect(() => {
    if (!open) return;
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);
  return (
    <aside
      id="sidebar"
      ref={panel}
      className={`sidebar ${open ? "open" : ""}`}
      aria-label="Workspace navigation"
    >
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          navigate("marketplace");
        }}
      >
        <span className="brand-mark">
          <img src="./assets/rebuild-mark.png" alt="" />
        </span>
        <span>
          Re<span>Build</span>
        </span>
      </a>
      <button ref={closeRef} className="sidebar-close nav-item" onClick={close}>
        <X />
        Close menu
      </button>
      <nav className="primary-nav" aria-label="Main navigation">
        {navItems.map(([id, Icon, label]) => (
          <button
            key={id}
            className={`nav-item ${view === id ? "active" : ""}`}
            aria-current={view === id ? "page" : undefined}
            onClick={() => (id === "listing" ? listMaterial() : navigate(id))}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="org-switcher">
          <span className="org-logo">NB</span>
          <span>
            <strong>Northbuild</strong>
            <small>Demo workspace</small>
          </span>
        </div>
        <button className="nav-item muted" onClick={reset}>
          <RotateCcw />
          <span>Reset demo</span>
        </button>
      </div>
    </aside>
  );
}
// Phone-sized viewports get a thumb-reachable tab bar instead of relying on
// the drawer for every move between the four destinations.
function BottomNav({ view, navigate, listMaterial }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <div className="bottom-nav-inner">
        {navItems.map(([id, Icon, label, short]) => (
          <button
            key={id}
            className={`bottom-nav-item ${view === id ? "active" : ""}`}
            aria-current={view === id ? "page" : undefined}
            aria-label={label}
            onClick={() => (id === "listing" ? listMaterial() : navigate(id))}
          >
            <Icon />
            <span aria-hidden="true">{short}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
function Topbar({
  query,
  setQuery,
  toggleMenu,
  menu,
  filters,
  setFilters,
  advanced,
  setAdvanced,
  menuRef,
}) {
  const searchRef = useRef(null);
  const filterRef = useRef(null);
  useEffect(() => {
    if (!advanced) return;
    const outside = (event) => {
      if (!searchRef.current?.contains(event.target)) setAdvanced(false);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setAdvanced(false);
        filterRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [advanced, setAdvanced]);
  useEffect(() => {
    const handler = (event) => {
      if (
        event.key === "/" &&
        !document.querySelector("dialog[open]") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        )
      ) {
        event.preventDefault();
        document.querySelector("#globalSearch")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <header className="topbar">
      <button
        ref={menuRef}
        className="icon-button menu-button"
        aria-label="Open navigation"
        aria-expanded={menu}
        aria-controls="sidebar"
        onClick={toggleMenu}
      >
        <Menu />
      </button>
      <div className="top-search" ref={searchRef}>
        <Search />
        <input
          id="globalSearch"
          type="search"
          aria-label="Search materials"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, model, size or material"
        />
        <kbd>/</kbd>
        <button
          ref={filterRef}
          className={`filter-button search-filter-toggle ${advanced || Object.values(filters).some(Boolean) ? "active" : ""}`}
          aria-label="Search filters"
          aria-expanded={advanced}
          aria-controls="search-filters"
          onClick={() => setAdvanced(!advanced)}
        >
          <SlidersHorizontal />
          <span>Filters</span>
        </button>
        {advanced && (
          <div id="search-filters" className="search-filter-popover">
            <SearchPanel
              filters={filters}
              setFilters={setFilters}
              clear={() => setFilters(initialFilters)}
            />
          </div>
        )}
      </div>
      <div className="top-actions">
        <div className="user-button">
          <span>AC</span>
          <span className="user-copy">
            <strong>Alex Chen</strong>
            <small>Project manager</small>
          </span>
        </div>
      </div>
    </header>
  );
}
function PageHeading({ eyebrow, title, copy, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
function MaterialCard({ item, request, offerCount = 0 }) {
  return (
    <article
      className="material-card"
      role="button"
      tabIndex={0}
      aria-label={`${item.isOwn ? "View" : "Request"} ${item.title}`}
      onClick={() => request(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          request(item);
        }
      }}
    >
      <div className="material-photo">
        <img
          src={imageFor(item)}
          alt={`Warehouse reference for ${item.title}`}
          loading="lazy"
        />
        {item.isOwn && <span className="match-badge">Your listing</span>}
      </div>
      <div className="material-body">
        <div className="material-top">
          <h3>{item.title}</h3>
          <strong>
            {money(item.price)}
            <small> / {item.unit}</small>
          </strong>
        </div>
        <p className="material-project">{item.project}</p>
        <div className="spec-list">
          <span>
            <b>Model</b>
            {item.model || "Not specified"}
          </span>
          <span>
            <b>Size</b>
            {item.dimensions}
          </span>
          <span>
            <b>Material</b>
            {item.material}
          </span>
        </div>
        <div className="material-meta">
          <span>
            <Package />
            {item.quantity.toLocaleString()} {item.unit}
          </span>
          <span>
            <MapPin />
            {item.location}
          </span>
        </div>
        <div className="card-footer">
          <span className="company-tag">
            <i>
              {item.company
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)}
            </i>
            {item.company}
          </span>
          {item.isOwn && (
            <span className="status">
              {offerCount} pending {offerCount === 1 ? "offer" : "offers"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
function SearchPanel({ filters, setFilters, clear }) {
  return (
    <section className="advanced-search" aria-label="Material type filter">
      <div className="advanced-grid">
        <label>
          Type
          <select
            value={filters.type}
            onChange={(event) => setFilters({ type: event.target.value })}
          >
            <option value="">All types</option>
            {categories.map((type) => (
              <option key={type} value={type}>
                {titleCase(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="advanced-actions">
        <button className="button ghost" onClick={clear}>
          Clear filter
        </button>
      </div>
    </section>
  );
}
function Modal({ title, eyebrow, close, busy, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <div className="modal-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="modal-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ProductDetails({ item }) {
  return (
    <div className="detail-content">
      <div className="detail-specs">
        {[
          ["Model", item.model || "Not specified"],
          ["Dimensions", item.dimensions],
          ["Material", item.material],
          ["Available", `${item.quantity} ${item.unit}`],
          [
            "Original price",
            item.originalPrice == null
              ? "Not provided"
              : `${money(item.originalPrice)} / ${item.unit} · CAD`,
          ],
          ["Listed price", `${money(item.price)} / ${item.unit} · CAD`],
        ].map(([label, value]) => (
          <span key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        ))}
      </div>
      <p>
        {item.notes} Weight: {item.weightKg} kg per {item.unit}.
      </p>
      {item.assessment && <AssessmentSummary result={item.assessment} />}
    </div>
  );
}
function AssessmentSummary({ result }) {
  const matchLabels = {
    consistent: "Appears consistent",
    mismatch: "Possible listing mismatch",
    unclear: "Could not assess match",
  };
  const conditionLabels = {
    no_visible_issue: "No visible issue found in sampled frames",
    visible_issue: "Visible issue reported",
    unclear: "Visible condition unclear",
  };
  const checkLabels = {
    category: "Category",
    appearance: "Appearance",
    material: "Material",
    model: "Model",
  };
  return (
    <section className="video-assessment" aria-label="Advisory video assessment">
      <strong>Video assessment · advisory</strong>
      <p>
        <b>Listing match:</b> {matchLabels[result.matchStatus] || matchLabels.unclear}
        {Number.isInteger(result.matchScore) &&
          ` · demo match score ${result.matchScore}/100 (${result.coverage}% of applicable checks assessed)`}
      </p>
      <p>
        <b>Visible condition:</b> {conditionLabels[result.condition?.status] || conditionLabels.unclear}
        {result.condition?.observation && ` — ${result.condition.observation}`}
        {Number.isInteger(result.condition?.timeSeconds) && ` (${result.condition.timeSeconds}s)`}
      </p>
      {Array.isArray(result.checks) && result.checks.length > 0 && (
        <ul>
          {result.checks.map((check, index) => (
            <li key={`${check.field}-${index}`}>
              <b>{checkLabels[check.field] || check.field}:</b> {check.status} — {check.observation}
              {Number.isInteger(check.timeSeconds) && ` (${check.timeSeconds}s)`}
            </li>
          ))}
        </ul>
      )}
      {result.matchStatus === "unclear" && (
        <p>For a clearer check, film the full item and any wear from more than one angle.</p>
      )}
      <small>
        Based only on sampled frames. This is not proof of authenticity, function, safety ratings, or hidden condition.
      </small>
    </section>
  );
}
function RequestModal({ item, close, complete, viewActivity }) {
  const [quantity, setQuantity] = useState("1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(null);
  const submit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const result = await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          listingId: item.id,
          quantity: Number(quantity),
          pickupDate:
            item.availableFrom > localDate() ? item.availableFrom : localDate(),
        }),
      });
      setReceipt(result);
      complete();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };
  if (receipt)
    return (
      <Modal title="Request pending" eyebrow={receipt.reference} close={close}>
        <div className="detail-content">
          <div className="success-mark">
            <Check />
          </div>
          <p>
            {quantity} {item.unit} of <strong>{item.title}</strong> are held
            while this request is reviewed.
          </p>
          <div className="receipt-lines">
            <span>
              Material total
              <strong>{money(receipt.amount_cents / 100)} CAD</strong>
            </span>
          </div>
          <p>
            Awaiting approval from the listing owner. Track its status in
            Activity. This is a local demo; no company is contacted.
          </p>
        </div>
        <div className="modal-actions">
          <button className="button primary" onClick={viewActivity}>
            View activity
            <ArrowRight />
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={item.isOwn ? item.title : "Request material"}
      eyebrow={item.company}
      close={close}
      busy={busy}
      className="checkout-modal"
    >
      <div className="checkout-product">
        <img src={imageFor(item)} alt="" />
        <span>
          <strong>{item.title}</strong>
          <small>
            {money(item.price)} / {item.unit} · {item.quantity} available
          </small>
        </span>
      </div>
      <ProductDetails item={item} />
      {!item.isOwn && (
        <form onSubmit={submit}>
          <div className="form-grid listing-form">
            <label>
              Quantity ({item.unit})
              <input
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                min={["units", "panels"].includes(item.unit) ? 1 : 0.01}
                step={["units", "panels"].includes(item.unit) ? 1 : 0.01}
                max={item.quantity}
                required
              />
            </label>
            <label>
              Total (CAD)
              <input
                value={money(Number(quantity || 0) * item.price)}
                readOnly
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
              <ArrowRight />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function OffersModal({ item, offers, close, refresh, notify }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = async (offer, status) => {
    setBusy(true);
    setError("");
    try {
      await api(`/reservations/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refresh();
      notify(
        status === "accepted"
          ? "Offer accepted."
          : "Offer declined. Inventory restored.",
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={item.title}
      eyebrow="My listing Offers"
      close={close}
      busy={busy}
    >
      <ProductDetails item={item} />
      <section className="listing-offers" aria-label="Offers on this listing">
        <h3>Offers ({offers.length})</h3>
        {offers.length ? (
          offers.map((offer) => (
            <article className="listing-offer" key={offer.id}>
              <div>
                <strong>{offer.company}</strong>
                <p>
                  {offer.quantity.toLocaleString()} {offer.unit}{" "}
                  {money(offer.amount_cents / 100)} CAD
                </p>
                <small>
                  {offer.reference}
                  {offer.isDemoOffer ? " Sample offer" : ""}
                </small>
              </div>
              <span className="status">
                {offer.status === "cancelled"
                  ? "Declined"
                  : statuses[offer.status]}
              </span>
              {offer.status === "requested" && (
                <div className="offer-actions">
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => update(offer, "accepted")}
                  >
                    Accept offer
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => update(offer, "cancelled")}
                  >
                    Decline
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <p>No offers yet.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </Modal>
  );
}
function ListingModal({ close, published }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [available, setAvailable] = useState(localDate());
  const [video, setVideo] = useState(null),
    [analyzing, setAnalyzing] = useState(false),
    [analysisError, setAnalysisError] = useState(""),
    [assessment, setAssessment] = useState(null);
  const formRef = useRef(null);
  const analysisRevision = useRef(0);
  const analyze = async () => {
    if (!video) {
      setAnalysisError("Choose a product video first.");
      return;
    }
    if (video.size > 50 * 1024 * 1024) {
      setAnalysisError("Choose a video smaller than 50 MB.");
      return;
    }
    const values = Object.fromEntries(new FormData(formRef.current));
    if (!values.title?.trim()) {
      setAnalysisError("Enter a listing title before analyzing the video.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError("");
    setAssessment(null);
    const revision = ++analysisRevision.current;
    try {
      const result = await assessVideo(video, values);
      if (revision === analysisRevision.current) setAssessment(result);
    } catch (problem) {
      if (revision === analysisRevision.current) setAnalysisError(problem.message);
    } finally {
      setAnalyzing(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (assessment) values.assessment = assessment;
    setBusy(true);
    setError("");
    try {
      await api("/listings", { method: "POST", body: JSON.stringify(values) });
      published();
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="List surplus material"
      eyebrow="New inventory · Northbuild"
      close={close}
      busy={busy || analyzing}
    >
      <form
        ref={formRef}
        onSubmit={submit}
        onChange={(event) => {
          if (["title", "type", "condition", "dimensions", "material", "model", "notes"].includes(event.target.name)) {
            analysisRevision.current += 1;
            setAssessment(null);
            setAnalysisError("");
          }
        }}
      >
        <div className="form-grid listing-form">
          <label className="full-field">
            Listing title
            <input
              name="title"
              placeholder="e.g. Commercial Doors"
              required
              maxLength="140"
            />
          </label>
          <label>
            Category
            <select name="type">
              {categories.map((type) => (
                <option value={type} key={type}>
                  {titleCase(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condition
            <select name="condition">
              {[
                "Unused",
                "Excellent",
                "Good",
                "Tested",
                "Needs refurbishment",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              max="10000000"
              required
            />
          </label>
          <label>
            Unit
            <select name="unit">
              {["units", "sq ft", "board ft", "linear ft", "panels"].map(
                (unit) => (
                  <option key={unit}>{unit}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Listed price per unit (CAD)
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              max="10000000"
              required
            />
            <small>Enter 0 to offer the material free.</small>
          </label>
          <label>
            Original price per unit (CAD)
            <input
              name="originalPrice"
              type="number"
              min="0"
              step="0.01"
              max="10000000"
              required
            />
          </label>
          <label>
            Weight (kg per unit)
            <input
              name="weightKg"
              type="number"
              min="0.01"
              step="0.01"
              max="10000000"
              required
            />
          </label>
          <label>
            Project
            <input
              name="project"
              defaultValue="King Street Retrofit"
              required
            />
          </label>
          <label>
            Location
            <input name="location" defaultValue="Toronto, ON" required />
          </label>
          <label>
            Available from
            <input
              name="availableFrom"
              type="date"
              value={available}
              min={localDate()}
              onChange={(event) => setAvailable(event.target.value)}
              required
            />
          </label>
          <label>
            Listing ends
            <input
              name="removeBy"
              type="date"
              defaultValue={dateOffset(7)}
              min={available > localDate() ? available : localDate()}
              required
            />
          </label>
          <label>
            Dimensions (optional)
            <input name="dimensions" placeholder="900 x 2100 x 45 mm" />
          </label>
          <label>
            Material (optional)
            <input name="material" placeholder="Solid oak" />
          </label>
          <label className="full-field">
            Model number (optional)
            <input
              name="model"
              placeholder="Manufacturer or product reference"
            />
          </label>
          <label className="full-field">
            Description (optional)
            <textarea name="notes" rows="3" maxLength="2000" />
          </label>
          <label className="full-field">
            Product video (optional)
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mov"
              onChange={(event) => {
                analysisRevision.current += 1;
                setVideo(event.target.files?.[0] || null);
                setAssessment(null);
                setAnalysisError("");
              }}
            />
            <small>The local server checks sampled frames from the first 30 seconds. Limit: 50 MB.</small>
          </label>
          <div className="full-field video-review-controls">
            <button
              type="button"
              className="button secondary"
              onClick={analyze}
              disabled={!video || busy || analyzing}
            >
              {analyzing ? "Analyzing video…" : "Analyze video"}
            </button>
            <small>The result is advisory; you can publish without a video check.</small>
          </div>
        </div>
        {analysisError && <p className="form-error" role="alert">{analysisError}</p>}
        {assessment && <div className="listing-assessment"><AssessmentSummary result={assessment} /></div>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || analyzing}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || analyzing}>
            {busy ? "Publishing…" : "Publish listing"}
            <ArrowRight />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Activity({ items, refresh, notify }) {
  const [filter, setFilter] = useState("all"),
    [confirmation, setConfirmation] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = async () => {
    setBusy(true);
    setError("");
    try {
      await api(`/reservations/${confirmation.item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: confirmation.status }),
      });
      setConfirmation(null);
      refresh();
      notify(
        confirmation.status === "cancelled"
          ? "Request cancelled. Inventory restored."
          : "Request updated.",
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  };
  const shown = items.filter(
    (item) =>
      item.status !== "collected" &&
      (filter === "all" ||
        (filter === "open"
          ? item.status !== "cancelled"
          : item.status === filter)),
  );
  const listed = shown.filter((item) => item.supplier === WORKSPACE);
  const requested = shown.filter((item) => item.supplier !== WORKSPACE);
  const renderGroup = (title, rows) =>
    rows.length ? (
      <section className="activity-group">
        <h2>{title}</h2>
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material / companies</th>
              <th>Quantity / value</th>
              <th>Status</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const pendingMyApproval =
                item.supplier === WORKSPACE && item.status === "requested";
              return (
                <tr key={item.id}>
                  <td data-label="Material / companies">
                    <strong>{item.title}</strong>
                    <small className="cell-note">
                      {item.supplier} → {item.company}
                    </small>
                    <small className="cell-note">{item.reference}</small>
                  </td>
                  <td data-label="Quantity / value">
                    {item.quantity.toLocaleString()} {item.unit}
                    <small className="cell-note">
                      {money(item.amount_cents / 100)} CAD
                    </small>
                  </td>
                  <td data-label="Status">
                    {!pendingMyApproval && (
                      <span className="status">
                        {item.status === "cancelled" &&
                        item.supplier === WORKSPACE
                          ? "Declined"
                          : statuses[item.status]}
                      </span>
                    )}
                    {item.status === "requested" &&
                      item.supplier !== WORKSPACE && (
                        <small className="cell-note">
                          Awaiting owner approval
                        </small>
                      )}
                  </td>
                  <td data-label="Next step">
                    {["requested", "accepted", "ready"].includes(
                      item.status,
                    ) && (
                      <div className="activity-actions">
                        {item.supplier === WORKSPACE &&
                          nextStatus[item.status] && (
                            <button
                              className="button primary"
                              onClick={() => {
                                setError("");
                                setConfirmation({
                                  item,
                                  status: nextStatus[item.status],
                                });
                              }}
                            >
                              {actionLabels[nextStatus[item.status]]}
                            </button>
                          )}
                        <button
                          className="text-link"
                          onClick={() => {
                            setError("");
                            setConfirmation({ item, status: "cancelled" });
                          }}
                        >
                          Cancel request
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
    ) : null;
  return (
    <>
      <div className="filters" aria-label="Activity status">
        {[
          ["all", "All activity"],
          ["open", "In progress"],
          ["cancelled", "Cancelled"],
        ].map(([value, label]) => (
          <button
            className={`filter-button ${filter === value ? "active" : ""}`}
            aria-pressed={filter === value}
            key={value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <>
          {renderGroup("Listed by you", listed)}
          {renderGroup("Requested to buy", requested)}
        </>
      ) : (
        <Empty
          title="No activity yet"
          copy="Request materials from the marketplace."
        />
      )}
      <p className="poc-note">
        Approve incoming offers on your listings. Outgoing requests await the
        owner's approval. No payment or supplier notification.
      </p>
      {confirmation && (
        <Modal
          title={
            confirmation.status === "cancelled"
              ? "Cancel request?"
              : actionLabels[confirmation.status]
          }
          eyebrow={confirmation.item.reference}
          close={() => setConfirmation(null)}
          busy={busy}
        >
          <div className="detail-content">
            <p>
              {confirmation.status === "cancelled"
                ? "The held quantity will be returned to available inventory."
                : "Accept this quantity. The materials remain held for the requesting company."}
            </p>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Go back
            </button>
            <button className="button primary" disabled={busy} onClick={update}>
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Empty({ title, copy, children }) {
  return (
    <div className="empty-state">
      <PackageOpen />
      <h2>{title}</h2>
      <p>{copy}</p>
      {children}
    </div>
  );
}
function App() {
  const [view, setView] = useState("marketplace"),
    [query, setQuery] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [filters, setFilters] = useState(initialFilters);
  const [materials, setMaterials] = useState([]),
    [reservations, setReservations] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [menu, setMenu] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState("");
  const timer = useRef(null);
  const menuRef = useRef(null);
  const refresh = () => setRevision((value) => value + 1);
  const notify = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  // The drawer only exists below the 900px breakpoint in styles.css; growing
  // past it must not leave the overlay and focus trap behind.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 901px)");
    const sync = (event) => {
      if (event.matches) setMenu(false);
    };
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);
  // Stop the page behind the drawer from scrolling under the overlay.
  useEffect(() => {
    if (!menu) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [menu]);
  const params = useMemo(
    () =>
      new URLSearchParams({
        q: query,
        mine: String(view === "mine"),
        ...filters,
      }).toString(),
    [query, view, filters],
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [list, activity] = await Promise.all([
          api(`/listings?${params}`),
          api("/reservations"),
        ]);
        if (active) {
          setMaterials(list);
          setReservations(activity);
          setError("");
        }
      } catch (problem) {
        if (active) setError(problem.message);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [params, revision]);
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => {});
  }, []);
  const navigate = (target) => {
    setView(target);
    setAdvanced(false);
    setQuery("");
    setFilters(initialFilters);
    setMenu(false);
  };
  const clear = () => {
    setQuery("");
    setFilters(initialFilters);
  };
  const visibleMaterials = materials.filter((item) =>
    view === "mine" ? item.isOwn : !item.isOwn,
  );
  const request = (item) =>
    setModal({ kind: item.isOwn ? "offers" : "request", item });
  return (
    <div className="app-shell">
      <Sidebar
        menuRef={menuRef}
        listMaterial={() => {
          setMenu(false);
          setModal({ kind: "listing" });
        }}
        view={view}
        navigate={navigate}
        open={menu}
        close={() => setMenu(false)}
        reset={() => {
          setMenu(false);
          setModal({ kind: "reset" });
        }}
      />
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <Topbar
          query={query}
          setQuery={(value) => {
            setQuery(value);
            setView("marketplace");
          }}
          toggleMenu={() => setMenu((value) => !value)}
          menu={menu}
          filters={filters}
          setFilters={(value) => {
            setFilters(value);
            setView("marketplace");
          }}
          advanced={advanced}
          setAdvanced={setAdvanced}
          menuRef={menuRef}
        />
        <section className="workspace">
          <PageHeading
            eyebrow={
              view === "marketplace"
                ? "Circular inventory network"
                : "Shared workspace"
            }
            title={
              view === "marketplace"
                ? "Available materials"
                : view === "mine"
                  ? "My listings"
                  : "Activity"
            }
            copy={
              view === "marketplace"
                ? "Explore surplus materials from across the marketplace."
                : view === "mine"
                  ? "Manage your listed materials."
                  : "Track material requests in one place."
            }
          />
          {storageNotice() && (
            <p className="form-error" role="status">
              {storageNotice()}
            </p>
          )}
          {error ? (
            <Empty title="Unable to load demo" copy={error}>
              <button className="button secondary" onClick={refresh}>
                Try again
              </button>
            </Empty>
          ) : loading ? (
            <Empty title="Loading inventory" copy="Preparing your workspace…" />
          ) : view === "activity" ? (
            <Activity items={reservations} refresh={refresh} notify={notify} />
          ) : visibleMaterials.length ? (
            <div className="listing-grid wide">
              {visibleMaterials.map((item) => (
                <MaterialCard
                  key={item.id}
                  item={item}
                  request={request}
                  offerCount={
                    reservations.filter(
                      (offer) =>
                        offer.listing_id === item.id &&
                        offer.status === "requested",
                    ).length
                  }
                />
              ))}
            </div>
          ) : (
            <Empty
              title={
                view === "mine"
                  ? "No matching workspace listings"
                  : "No materials found"
              }
              copy="Try another search, clear the filters, or publish your first material listing."
            >
              <button className="button secondary" onClick={clear}>
                Clear search and filters
              </button>
            </Empty>
          )}
        </section>
      </main>
      {modal?.kind === "listing" && (
        <ListingModal
          close={() => setModal(null)}
          published={() => {
            setModal(null);
            clear();
            setView("mine");
            refresh();
            notify("Your material listing has been published.");
          }}
        />
      )}
      {modal?.kind === "offers" && (
        <OffersModal
          item={
            materials.find((item) => item.id === modal.item.id) || modal.item
          }
          offers={reservations.filter(
            (offer) => offer.listing_id === modal.item.id,
          )}
          close={() => setModal(null)}
          refresh={async () => {
            const [list, activity] = await Promise.all([
              api(`/listings?${params}`),
              api("/reservations"),
            ]);
            setMaterials(list);
            setReservations(activity);
          }}
          notify={notify}
        />
      )}
      {modal?.kind === "request" && (
        <RequestModal
          item={modal.item}
          close={() => setModal(null)}
          complete={refresh}
          viewActivity={() => {
            setModal(null);
            navigate("activity");
          }}
        />
      )}
      {modal?.kind === "reset" && (
        <Modal
          title="Reset demo?"
          eyebrow="Demo controls"
          close={() => setModal(null)}
        >
          <div className="detail-content">
            <p>
              Remove this browser’s created listings and requests, and restore
              the original material catalog.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Keep demo
            </button>
            <button
              className="button primary"
              onClick={async () => {
                await api("/reset", { method: "POST" });
                setModal(null);
                clear();
                setView("marketplace");
                refresh();
                notify("Demo reset. Original inventory restored.");
              }}
            >
              Reset demo
            </button>
          </div>
        </Modal>
      )}
      <BottomNav
        view={view}
        navigate={navigate}
        listMaterial={() => {
          setMenu(false);
          setModal({ kind: "listing" });
        }}
      />
      <div className={`toast ${toast ? "show" : ""}`} role="status">
        <CircleCheck />
        <span>{toast}</span>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
