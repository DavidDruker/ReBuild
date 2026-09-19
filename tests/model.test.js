import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  addDemoOffers,
  createListing,
  requestMaterial,
  transitionReservation,
  impact,
  searchListings,
  localDate,
  dateOffset,
} from "../src/model.js";
const doors = () => ({
  title: "Commercial Doors",
  type: "doors",
  quantity: 200,
  unit: "units",
  condition: "Unused",
  price: 85,
  weightKg: 32,
  project: "Harbourfront Office Retrofit",
  location: "Toronto Waterfront",
  availableFrom: localDate(),
  removeBy: dateOffset(7),
});
const request = (state, quantity = 120) =>
  requestMaterial(state, {
    listingId: state.listings.at(-1).id,
    company: "Cedar Works",
    quantity,
    pickupDate: localDate(),
  });
const search = (state, q) => searchListings(state, new URLSearchParams({ q }));
test("partial handoff preserves remaining stock and counts impact only once", () => {
  let state = createListing(initialState(), doors());
  state = request(state);
  assert.equal(state.listings.at(-1).quantity, 80);
  assert.deepEqual(impact(state), {
    transfers: 0,
    units: 0,
    value: 0,
    mass: 0,
  });
  for (const status of ["accepted", "ready", "collected"])
    state = transitionReservation(state, 1, status);
  assert.deepEqual(impact(state), {
    transfers: 1,
    units: 120,
    value: 10200,
    mass: 3840,
  });
  assert.equal(state.listings.at(-1).quantity, 80);
  assert.throws(() => transitionReservation(state, 1, "collected"));
  assert.throws(() => transitionReservation(state, 1, "cancelled"));
});
test("seed search, live listings, partial / case-insensitive search and no results", () => {
  let state = initialState();
  assert.equal(state.listings.length, 30);
  assert.equal(search(state, "Porcelain floor tile").length, 1);
  assert.equal(search(state, "PORCELAIN").length, 1);
  assert.equal(search(state, "Commercial Doors").length, 0);
  state = createListing(state, doors());
  assert.equal(search(state, "Commercial Doors").length, 0);
  assert.equal(search(state, "no such item").length, 0);
  assert.equal(
    searchListings(state, new URLSearchParams({ mine: "true" })).length,
    initialState().listings.filter((item) => item.isOwn).length + 1,
  );
});
test("reject missing, invalid, fractional, non-finite and reversed-date listing inputs", () => {
  for (const override of [
    { title: "  " },
    { quantity: 0 },
    { quantity: 1.5 },
    { price: -1 },
    { price: Infinity },
    { weightKg: "" },
    { weightKg: 0 },
    { quantity: NaN },
    { type: "unknown" },
    { unit: "mystery" },
    { condition: "unknown" },
    { removeBy: "2026-02-30" },
    { availableFrom: dateOffset(8) },
  ])
    assert.throws(() =>
      createListing(initialState(), { ...doors(), ...override }),
    );
  assert.equal(
    createListing(initialState(), { ...doors(), price: 0 }).listings.at(-1)
      .price,
    0,
  );
});
test("reject overbooking, zero, fractional, duplicate full reservation and invalid pickup", () => {
  const state = createListing(initialState(), doors());
  for (const quantity of [0, -1, 201, 1.5, NaN])
    assert.throws(() => request(state, quantity));
  const full = request(state, 200);
  assert.equal(full.listings.at(-1).quantity, 0);
  assert.equal(search(full, "Commercial Doors").length, 0);
  assert.throws(() => request(full, 1));
  assert.throws(() =>
    requestMaterial(state, {
      listingId: state.listings.at(-1).id,
      company: "Northbuild",
      quantity: 1,
      pickupDate: localDate(),
    }),
  );
  assert.throws(() =>
    requestMaterial(state, {
      listingId: state.listings.at(-1).id,
      company: "Cedar Works",
      quantity: 1,
      pickupDate: dateOffset(8),
    }),
  );
});
test("cancellation restores stock exactly once across multiple partial requests", () => {
  let state = createListing(initialState(), doors());
  state = request(state, 120);
  state = request(state, 80);
  state = transitionReservation(state, 1, "cancelled");
  assert.equal(state.listings.at(-1).quantity, 120);
  state = transitionReservation(state, 2, "cancelled");
  assert.equal(state.listings.at(-1).quantity, 200);
  assert.throws(() => transitionReservation(state, 2, "cancelled"));
  assert.equal(impact(state).mass, 0);
});
test("only valid handoff transitions and completion after acceptance and readiness", () => {
  let state = request(createListing(initialState(), doors()));
  assert.throws(() => transitionReservation(state, 1, "collected"));
  state = transitionReservation(state, 1, "accepted");
  assert.throws(() => transitionReservation(state, 1, "accepted"));
  assert.throws(() => transitionReservation(state, 999, "ready"));
});
test("existing sample material requests are outgoing and decimal area is supported", () => {
  let state = requestMaterial(initialState(), {
    listingId: 3,
    quantity: 10.25,
    pickupDate: localDate(),
  });
  assert.equal(state.reservations[0].company, "Northbuild");
  assert.equal(state.reservations[0].direction, "pickup");
  assert.equal(state.listings[2].quantity, 849.75);
  state = transitionReservation(state, 1, "cancelled");
  assert.equal(state.listings[2].quantity, 860);
});
test("reset baseline is deterministic, empty, and survives serialization", () => {
  const fresh = initialState();
  assert.equal(fresh.reservations.length, 0);
  assert.equal(fresh.listings.length, 30);
  assert.equal(impact(fresh).value, 0);
  const persisted = JSON.parse(
    JSON.stringify(request(createListing(fresh, doors()))),
  );
  assert.equal(persisted.listings.at(-1).quantity, 80);
  assert.equal(persisted.reservations[0].status, "requested");
  assert.equal(fresh.listings.length, 30);
});

test("marketplace excludes own listings from all searches while My listings retains them", () => {
  const state = createListing(initialState(), {
    ...doors(),
    originalPrice: 160,
  });
  for (const q of ["", "Commercial Doors", "Northbuild", "FD90-OAK-900"]) {
    assert.ok(search(state, q).every((item) => !item.isOwn));
  }
  const own = searchListings(
    state,
    new URLSearchParams({ mine: "true", q: "Commercial Doors" }),
  );
  assert.equal(own.length, 1);
  assert.equal(own[0].originalPrice, 160);
  assert.equal(own[0].price, 85);
  assert.throws(() => createListing(state, { ...doors(), originalPrice: -1 }));
});

test("outgoing requests stay pending and cannot be self-approved", () => {
  const state = requestMaterial(initialState(), {
    listingId: 3,
    quantity: 10,
    pickupDate: localDate(),
  });
  assert.equal(state.reservations[0].status, "requested");
  for (const status of ["accepted", "ready", "collected"]) {
    assert.throws(
      () => transitionReservation(state, 1, status),
      /Only the listing owner/,
    );
  }
  assert.equal(
    transitionReservation(state, 1, "cancelled").listings[2].quantity,
    860,
  );
});

test("sample offers preserve existing data and seed once across reloads", () => {
  const before = requestMaterial(createListing(initialState(), doors()), {
    listingId: 3,
    quantity: 10,
    pickupDate: localDate(),
  });
  let state = addDemoOffers(before);
  assert.deepEqual(state.listings.at(-1), before.listings.at(-1));
  assert.deepEqual(
    state.reservations.find((offer) => offer.id === 1),
    before.reservations[0],
  );
  const eligible = before.listings.filter(
    (item) => item.isOwn && item.isSeeded,
  );
  eligible.forEach((listing, index) => {
    const offers = state.reservations.filter(
      (offer) => offer.listing_id === listing.id,
    );
    const expectedCount = index === 0 ? 2 : 1;
    assert.equal(offers.length, expectedCount);
    assert.equal(
      new Set(offers.map((offer) => offer.company)).size,
      expectedCount,
    );
    assert.ok(
      offers.every(
        (offer) => offer.status === "requested" && offer.isDemoOffer,
      ),
    );
    assert.equal(
      state.listings.find((item) => item.id === listing.id).quantity +
        offers.reduce((sum, offer) => sum + offer.quantity, 0),
      listing.quantity,
    );
  });
  const [offer, sibling] = state.reservations.filter(
    (row) => row.listing_id === eligible[0].id,
  );
  state = transitionReservation(state, offer.id, "accepted");
  assert.equal(
    state.reservations.find((row) => row.id === sibling.id).status,
    "requested",
  );
  state = transitionReservation(state, sibling.id, "cancelled");
  assert.throws(() => transitionReservation(state, sibling.id, "cancelled"));
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(addDemoOffers(restored), state);
  assert.equal(
    new Set(state.reservations.map((row) => row.id)).size,
    state.reservations.length,
  );
});

test("type dropdown filtering combines with search and excludes own inventory", () => {
  const state = initialState();
  for (const type of ["doors", "flooring"]) {
    const rows = searchListings(state, new URLSearchParams({ type }));
    assert.ok(rows.length > 0);
    assert.ok(rows.every((item) => item.type === type && !item.isOwn));
  }
  assert.equal(
    searchListings(
      state,
      new URLSearchParams({ type: "flooring", q: "porcelain" }),
    ).length,
    1,
  );
  assert.equal(
    searchListings(
      state,
      new URLSearchParams({ type: "doors", q: "porcelain" }),
    ).length,
    0,
  );
});
