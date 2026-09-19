import {
  initialState,
  addDemoOffers,
  createListing,
  requestMaterial,
  transitionReservation,
  searchListings,
  impact,
} from "./model.js";
const KEY = "rebuild-poc-v2";
let state;
let storageError = "";
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (
    saved &&
    (saved.version !== 2 ||
      !Array.isArray(saved.listings) ||
      !Array.isArray(saved.reservations) ||
      !Number.isInteger(saved.nextListing) ||
      !Number.isInteger(saved.nextReservation) ||
      saved.listings.some(
        (item) =>
          !Number.isFinite(item.quantity) || typeof item.title !== "string",
      ))
  )
    throw new Error("Invalid saved data");
  state = saved || initialState();
} catch {
  state = initialState();
  storageError =
    "Saved demo data could not be loaded. A fresh demo is running in this tab.";
}
export const storageNotice = () => storageError;
function save(next) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    storageError =
      "Browser storage is unavailable. Changes last for this tab only.";
  }
}
const withOffers = addDemoOffers(state);
if (withOffers !== state) save(withOffers);

export async function api(path, options = {}) {
  const url = new URL(path, "https://rebuild.local");
  const body = options.body ? JSON.parse(options.body) : {};
  if (url.pathname === "/listings" && options.method === "POST") {
    save(createListing(state, body));
    return state.listings.at(-1);
  }
  if (url.pathname === "/listings")
    return searchListings(state, url.searchParams);
  if (url.pathname === "/reservations" && options.method === "POST") {
    if (
      state.listings.find((item) => item.id === Number(body.listingId))?.isOwn
    )
      throw new Error("You cannot request your own listing.");
    save(requestMaterial(state, body));
    return state.reservations[0];
  }
  if (url.pathname === "/reservations") return state.reservations;
  if (url.pathname.startsWith("/reservations/") && options.method === "PATCH") {
    save(
      transitionReservation(
        state,
        Number(url.pathname.split("/").at(-1)),
        body.status,
      ),
    );
    return { status: body.status };
  }
  if (url.pathname === "/impact")
    return {
      ...impact(state),
      quantities: state.reservations
        .filter((item) => item.status === "collected")
        .reduce(
          (result, item) => ({
            ...result,
            [item.unit]: (result[item.unit] || 0) + item.quantity,
          }),
          {},
        ),
    };
  if (url.pathname === "/reset" && options.method === "POST") {
    save(addDemoOffers(initialState()));
    return { ok: true };
  }
  throw new Error("This action is unavailable.");
}
