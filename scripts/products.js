const STORAGE_KEY = "northStarBakery.productView";
const FILTER_GROUPS = ["category", "price", "dietary"];
const DEFAULT_SORT = "best-sellers";

// Each price filter matches any product whose price range overlaps it,
// since most products come in more than one size.
const PRICE_RANGES = {
  "under-10": (min) => min < 10,
  "10-40": (min, max) => min <= 40 && max >= 10,
  "over-40": (_min, max) => max > 40,
};

const SORTERS = {
  "best-sellers": (a, b) => a.bestSeller - b.bestSeller,
  "price-low-high": (a, b) => a.priceMin - b.priceMin,
  "price-high-low": (a, b) => highestPrice(b) - highestPrice(a),
  name: (a, b) => a.name.localeCompare(b.name),
};

const filterForm = document.querySelector(".product-filters form");
const sortSelect = document.querySelector("#sort-by");
const productCount = document.querySelector("#product-count");
const activeFilterList = document.querySelector("#active-filters");
const emptyState = document.querySelector("#product-empty");

/* Reading and writing the view state */

/**
 * Gets every checkbox in a filter group.
 * @param group - "category", "price", or "dietary"
 * @returns the group's checkboxes
 */
function getCheckboxes(group) {
  return filterForm.querySelectorAll(`input[name="${group}"]`);
}

/**
 * Reads the checked filters and sort choice from the page.
 * @returns the current filters and sort
 */
function readStateFromPage() {
  const filters = {};

  FILTER_GROUPS.forEach((group) => {
    filters[group] = Array.from(getCheckboxes(group))
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  });

  return { filters, sort: sortSelect.value };
}

/**
 * Checks the boxes and sets the sort menu to match a saved state.
 * Unknown values are ignored since no checkbox or option matches them.
 * @param state
 */
function applyStateToPage(state) {
  FILTER_GROUPS.forEach((group) => {
    const selected = state.filters?.[group] ?? [];
    getCheckboxes(group).forEach((checkbox) => {
      checkbox.checked = selected.includes(checkbox.value);
    });
  });

  const sortExists = Array.from(sortSelect.options).some((option) => option.value === state.sort);
  sortSelect.value = sortExists ? state.sort : DEFAULT_SORT;

  openGroupsWithSelections();
}

/**
 * Expands any filter group with a checked box, so shoppers can see why the list is filtered.
 */
function openGroupsWithSelections() {
  filterForm.querySelectorAll("details").forEach((group) => {
    if (group.querySelector("input:checked")) {
      group.open = true;
    }
  });
}

/* Browser storage */

/**
 * Saves the view state to localStorage.
 * @param state
 */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (e.g. private browsing). The page
    // still works; the view just won't be remembered.
  }
}

/**
 * Loads the saved view state from localStorage.
 * @returns the saved state, or null if nothing valid is saved
 */
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/* Filtering and sorting */

/**
 * Gets the top of a product's price range.
 * @param product
 * @returns the highest price
 */
function highestPrice(product) {
  return product.priceMax ?? product.priceMin;
}

/**
 * Checks whether a product's price overlaps any of the chosen price ranges.
 * @param product
 * @param ranges - keys of PRICE_RANGES
 * @returns true if any range matches
 */
function matchesPrice(product, ranges) {
  const max = product.priceMax ?? Infinity;
  return ranges.some((range) => PRICE_RANGES[range](product.priceMin, max));
}

/**
 * Checks whether a product meets every chosen dietary need.
 * @param product
 * @param needs
 * @returns true if every need is met
 */
function matchesDietary(product, needs) {
  return needs.every((need) => product.dietary.includes(need));
}

/**
 * Checks a product against all filter groups. Category and price options widen the
 * results (Breads OR Cakes), while dietary needs narrow them (Vegan AND Nut-free).
 * @param product
 * @param filters
 * @returns true if the product should be shown
 */
function matchesFilters(product, filters) {
  const { category, price, dietary } = filters;

  if (category.length && !category.includes(product.category)) return false;
  if (price.length && !matchesPrice(product, price)) return false;
  if (dietary.length && !matchesDietary(product, dietary)) return false;
  return true;
}

/**
 * Filters and sorts the product list for the current view.
 * @param state
 * @returns the products to show, in sorted order
 */
function getVisibleProducts(state) {
  const sorter = SORTERS[state.sort] ?? SORTERS[DEFAULT_SORT];
  return PRODUCTS.filter((product) => matchesFilters(product, state.filters)).sort(sorter);
}

/* Rendering */

/**
 * Formats a product's price range for display, e.g. "$9 – $12" or "From $150".
 * @param product
 * @returns the formatted price
 */
function formatPrice(product) {
  if (product.priceMax === null) return `From $${product.priceMin}`;
  if (product.priceMin === product.priceMax) return `$${product.priceMin}`;
  return `$${product.priceMin} – $${product.priceMax}`;
}

/**
 * Creates an element with an optional class and text.
 * @param tag
 * @param [className]
 * @param [text]
 * @returns the new element
 */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

/**
 * Builds the card for one product.
 * @param product
 * @returns the card's list item
 */
function createProductCard(product) {
  const card = createElement("li", "product-card");

  const image = document.createElement("img");
  Object.assign(image, product.image, { loading: "lazy" });

  const name = createElement("h4", "typography-card-label", product.name);
  const price = createElement("p", "price typography-card-label", formatPrice(product));
  const description = createElement("p", "typography-card-description", product.description);

  if (product.inquiry) {
    const link = createElement("a", "", "Send us an inquiry");
    link.href = "contact.html";
    description.append(" ", link, " to start planning.");
  }

  card.append(image, name, price, description);
  return card;
}

/**
 * Renders products into their category sections, hiding empty sections.
 * @param products
 */
function renderProducts(products) {
  document.querySelectorAll(".product-category").forEach((section) => {
    const grid = section.querySelector(".product-grid");
    const matches = products.filter((product) => product.category === section.dataset.category);

    grid.replaceChildren(...matches.map(createProductCard));
    section.hidden = matches.length === 0;
  });

  emptyState.hidden = products.length > 0;
}

/**
 * Updates the product count. Kept short so it stays on one line beside the sort menu on phones.
 * @param visibleCount
 */
function renderCount(visibleCount) {
  const total = PRODUCTS.length;
  productCount.textContent =
    visibleCount === total ? `All ${total} products` : `${visibleCount} of ${total} products`;
}

/**
 * Gets the visible label text for a filter checkbox.
 * @param checkbox
 * @returns the label text
 */
function getFilterLabel(checkbox) {
  return checkbox.closest("label").textContent.trim();
}

/**
 * Moves focus after a chip is removed: to the chip that took its place, the
 * previous one, or the sort menu once no chips are left.
 * @param index - position of the removed chip
 */
function focusChipNear(index) {
  const chips = activeFilterList.querySelectorAll("button");
  const target = chips[index] ?? chips[index - 1] ?? sortSelect;
  target.focus();
}

/**
 * Builds a removable chip for a checked filter.
 * @param checkbox
 * @param index
 * @returns the chip's list item
 */
function createFilterChip(checkbox, index) {
  const label = getFilterLabel(checkbox);
  const item = document.createElement("li");
  const button = createElement("button", "filter-chip", label);

  button.type = "button";
  button.setAttribute("aria-label", `Remove ${label} filter`);
  button.addEventListener("click", () => {
    checkbox.checked = false;
    updateProducts();
    focusChipNear(index);
  });

  item.append(button);
  return item;
}

/**
 * Renders a chip for every checked filter.
 */
function renderActiveFilters() {
  const checked = filterForm.querySelectorAll("input:checked");
  activeFilterList.replaceChildren(
    ...Array.from(checked).map((checkbox, index) => createFilterChip(checkbox, index)),
  );
  activeFilterList.hidden = checked.length === 0;
}

/* Wiring it together */

/**
 * Re-renders the page from the current filters and sort, then saves the view.
 */
function updateProducts() {
  const state = readStateFromPage();
  const visible = getVisibleProducts(state);

  renderProducts(visible);
  renderCount(visible.length);
  renderActiveFilters();
  saveState(state);
}

/**
 * Unchecks every filter and re-renders.
 */
function clearFilters() {
  filterForm.querySelectorAll("input:checked").forEach((checkbox) => (checkbox.checked = false));
  updateProducts();
}

/**
 * Restores the saved view, attaches event listeners, and renders the products.
 */
function initProductFilters() {
  const savedState = loadState();
  if (savedState) applyStateToPage(savedState);

  filterForm.addEventListener("change", updateProducts);
  sortSelect.addEventListener("change", updateProducts);

  // Filter reset
  filterForm.addEventListener("reset", (event) => {
    event.preventDefault();
    clearFilters();
  });
  emptyState.querySelector("button").addEventListener("click", clearFilters);

  updateProducts();
}

initProductFilters();
