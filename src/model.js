import { catalogRows } from "./catalog.js";
export const WORKSPACE = "Northbuild";
export const categories = [
  "doors",
  "lumber",
  "flooring",
  "fixtures",
  "windows",
  "steel",
  "brick",
  "partitions",
  "roofing",
  "ceilings",
  "stone",
  "insulation",
];
export const localDate = () => new Date().toLocaleDateString("en-CA");
export function dateOffset(days, from = localDate()) {
  const date = new Date(`${from}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}
export const photoFor = (type) =>
  `./assets/reclaimed-${{ doors: "warehouse", lumber: "lumber", flooring: "tile", fixtures: "fixtures", windows: "windows" }[type] || "warehouse"}.jpg`;
export function initialState() {
  return {
    version: 2,
    nextListing: catalogRows.length + 1,
    nextReservation: 1,
    reservations: [],
    listings: catalogRows.map(
      (
        [
          company,
          initials,
          project,
          location,
          type,
          title,
          quantity,
          unit,
          condition,
          price,
          model,
          dimensions,
          material,
          buildingTypes,
          weightKg,
          notes,
        ],
        index,
      ) => ({
        id: index + 1,
        company,
        initials,
        project,
        location,
        type,
        title,
        quantity,
        unit,
        condition,
        price,
        model,
        dimensions,
        material,
        buildingTypes,
        weightKg,
        notes,
        image: photoFor(type),
        availableFrom: localDate(),
        removeBy: dateOffset(30),
        status: "published",
        isOwn: company === WORKSPACE,
        isSeeded: true,
      }),
    ),
  };
}
const fail = (message) => {
  throw new Error(message);
};
function text(body, key, required = true) {
  const value = body[key];
  if ((value === undefined || value === "") && !required) return "";
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > 2000
  )
    fail(`Please provide a valid ${key}.`);
  return value.trim();
}
function number(body, key, min) {
  if (
    body[key] === "" ||
    body[key] === null ||
    !["number", "string"].includes(typeof body[key])
  )
    fail(`Please provide a valid ${key}.`);
  const value = Number(body[key]);
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > 10000000 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  )
    fail(
      `${key} must be between ${min} and 10,000,000, with up to two decimal places.`,
    );
  return value;
}
function date(body, key) {
  const value = text(body, key);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(`Please provide a valid ${key}.`);
  return value;
}
export function createListing(state, body) {
  const values = Object.fromEntries(
    ["title", "type", "project", "location", "unit", "condition"].map((key) => [
      key,
      text(body, key),
    ]),
  );
  if (!categories.includes(values.type)) fail("Choose a valid category.");
  if (
    !["units", "sq ft", "board ft", "linear ft", "panels"].includes(values.unit)
  )
    fail("Choose a valid unit.");
  if (
    !["Unused", "Excellent", "Good", "Tested", "Needs refurbishment"].includes(
      values.condition,
    )
  )
    fail("Choose a valid condition.");
  const quantity = number(body, "quantity", 0.01),
    price = number(body, "price", 0),
    weightKg = number(body, "weightKg", 0.01);
  if (["units", "panels"].includes(values.unit) && !Number.isInteger(quantity))
    fail("Units and panels require a whole quantity.");
  const availableFrom = date(body, "availableFrom"),
    removeBy = date(body, "removeBy");
  if (removeBy < availableFrom || removeBy < localDate())
    fail(
      "Pickup deadline must be today or later, and after availability begins.",
    );
  const listing = {
    ...values,
    id: state.nextListing,
    company: WORKSPACE,
    isOwn: true,
    isSeeded: false,
    quantity,
    price,
    originalPrice:
      body.originalPrice == null || body.originalPrice === ""
        ? null
        : number(body, "originalPrice", 0),
    weightKg,
    availableFrom,
    removeBy,
    model: text(body, "model", false),
    dimensions: text(body, "dimensions", false) || "Not specified",
    material: text(body, "material", false) || values.title,
    notes: text(body, "notes", false),
    image: photoFor(values.type),
    status: "published",
  };
  return {
    ...state,
    nextListing: state.nextListing + 1,
    listings: [...state.listings, listing],
  };
}
export function requestMaterial(state, body) {
  const listing = state.listings.find(
    (item) => item.id === Number(body.listingId),
  );
  if (!listing) fail("Listing not found.");
  const quantity = number(body, "quantity", 0.01),
    pickupDate = date(body, "pickupDate");
  if (["units", "panels"].includes(listing.unit) && !Number.isInteger(quantity))
    fail("Choose a whole quantity for this material.");
  if (quantity > listing.quantity || listing.status !== "published")
    fail("That quantity is no longer available. Refresh the listing.");
  if (
    pickupDate < localDate() ||
    pickupDate < listing.availableFrom ||
    pickupDate > listing.removeBy
  )
    fail("Choose a pickup date within the available window.");
  const company = listing.isOwn ? text(body, "company") : WORKSPACE;
  if (company.toLowerCase() === listing.company.toLowerCase())
    fail("The requesting company must be different from the listing owner.");
  const reservation = {
    id: state.nextReservation,
    reference: `RB-${String(state.nextReservation).padStart(5, "0")}`,
    listing_id: listing.id,
    title: listing.title,
    type: listing.type,
    unit: listing.unit,
    image: listing.image,
    notes: listing.notes,
    location: listing.location,
    project: listing.project,
    supplier: listing.company,
    company,
    quantity,
    weightKg: listing.weightKg,
    amount_cents: Math.round(listing.price * quantity * 100),
    pickup_date: pickupDate,
    status: "requested",
    direction: listing.isOwn ? "handover" : "pickup",
  };
  return {
    ...state,
    nextReservation: state.nextReservation + 1,
    reservations: [reservation, ...state.reservations],
    listings: state.listings.map((item) =>
      item.id === listing.id
        ? {
            ...item,
            quantity: Math.round((item.quantity - quantity) * 100) / 100,
            status: item.quantity === quantity ? "reserved" : "published",
          }
        : item,
    ),
  };
}
export function transitionReservation(state, id, status) {
  const item = state.reservations.find((item) => item.id === Number(id));
  if (!item) fail("Request not found.");
  const listing = state.listings.find(
    (listing) => listing.id === item.listing_id,
  );
  if (
    status !== "cancelled" &&
    (!listing?.isOwn ||
      listing.company !== WORKSPACE ||
      item.company === WORKSPACE)
  )
    fail("Only the listing owner can approve this request.");
  const allowed = {
    requested: ["accepted", "cancelled"],
    accepted: ["ready", "cancelled"],
    ready: ["collected", "cancelled"],
  };
  if (!allowed[item.status]?.includes(status))
    fail("This request cannot move to that status.");
  return {
    ...state,
    reservations: state.reservations.map((row) =>
      row.id === item.id ? { ...row, status } : row,
    ),
    listings:
      status === "cancelled"
        ? state.listings.map((row) =>
            row.id === item.listing_id
              ? {
                  ...row,
                  quantity:
                    Math.round((row.quantity + item.quantity) * 100) / 100,
                  status: "published",
                }
              : row,
          )
        : state.listings,
  };
}
export function impact(state) {
  return state.reservations
    .filter((item) => item.status === "collected")
    .reduce(
      (total, item) => ({
        transfers: total.transfers + 1,
        units: total.units + item.quantity,
        value: total.value + item.amount_cents / 100,
        mass: total.mass + item.weightKg * item.quantity,
      }),
      { transfers: 0, units: 0, value: 0, mass: 0 },
    );
}
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[×*]/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function searchListings(state, params) {
  let rows = state.listings.filter((item) =>
    params.get("mine") === "true"
      ? item.isOwn
      : !item.isOwn && item.quantity > 0 && item.removeBy >= localDate(),
  );
  if (params.get("type") && params.get("type") !== "all")
    rows = rows.filter((item) => item.type === params.get("type"));
  if (params.get("condition"))
    rows = rows.filter((item) => item.condition === params.get("condition"));
  for (const key of ["model", "material", "location", "dimensions"])
    if (params.get(key))
      rows = rows.filter((item) =>
        normalize(item[key]).includes(normalize(params.get(key))),
      );
  if (params.get("q"))
    rows = rows.filter((item) =>
      normalize(params.get("q"))
        .split(" ")
        .every((token) =>
          normalize(
            `${item.title} ${item.model} ${item.material} ${item.dimensions} ${item.company} ${item.location}`,
          ).includes(token),
        ),
    );
  const sort = params.get("sort");
  return rows.sort((a, b) =>
    sort === "price-asc"
      ? a.price - b.price
      : sort === "newest"
        ? b.id - a.id
        : a.removeBy.localeCompare(b.removeBy) || a.id - b.id,
  );
}

// Add sample incoming offers once, preserving existing browser inventory and requests.
export function addDemoOffers(state) {
  if (state.demoOffersVersion === 3) return state;
  let next = state;
  if (state.demoOffersVersion != null) {
    const stale = state.reservations.filter(
      (item) => item.isDemoOffer && item.status === "requested",
    );
    next = {
      ...state,
      reservations: state.reservations.filter(
        (item) => !(item.isDemoOffer && item.status === "requested"),
      ),
      listings: state.listings.map((listing) => {
        const restore = stale
          .filter((offer) => offer.listing_id === listing.id)
          .reduce((sum, offer) => sum + offer.quantity, 0);
        return restore
          ? {
              ...listing,
              quantity: Math.round((listing.quantity + restore) * 100) / 100,
              status: "published",
            }
          : listing;
      }),
    };
  }
  const companies = ["Cedar Works", "Atlas Demo", "Urban Core"];
  const eligible = state.listings.filter(
    (item) =>
      item.isOwn &&
      item.isSeeded &&
      item.quantity > 0 &&
      item.status === "published" &&
      item.removeBy >= localDate(),
  );
  eligible.forEach((listing, listingIndex) => {
    const quantity = Math.floor(listing.quantity / 10);
    if (quantity < 1) return;
    const offerCount = listingIndex === 0 ? 2 : 1;
    for (let index = 0; index < offerCount; index++) {
      next = requestMaterial(next, {
        listingId: listing.id,
        company: companies[index],
        quantity: quantity * (index + 1),
        pickupDate:
          listing.availableFrom > localDate()
            ? listing.availableFrom
            : localDate(),
      });
      next = {
        ...next,
        reservations: next.reservations.map((offer, i) =>
          i === 0 ? { ...offer, isDemoOffer: true } : offer,
        ),
      };
    }
  });
  return { ...next, demoOffersVersion: 3 };
}
