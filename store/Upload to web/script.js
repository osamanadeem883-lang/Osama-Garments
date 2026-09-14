// Content, categories and products all come from store-data.js,
// which admin.html writes. A draft saved in the admin overrides it on
// the admin's own machine only - customers always see store-data.js.

const DRAFT_KEY = "osamaStoreDraft";
const DRAFT_AT_KEY = "osamaStoreDraftAt";
const ORDERS_KEY = "osamaOrders";

function loadStore() {

  const published = window.STORE_DATA;

  let draft = null;

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) draft = JSON.parse(raw);
  } catch (err) {
    draft = null;
  }

  // A draft saved in this browser used to win no matter what, so a newly
  // published store-data.js could sit there looking like nothing happened.
  // Now the newer of the two wins, and a stale draft is cleared out.
  //
  // The draft's own savedAt is what decides it. The separate key is only a
  // fallback for drafts written by an older admin: the admin writes the two
  // keys one after the other, so a page reacting to the first write would
  // read the OLD timestamp and throw away a draft that was a millisecond old.
  if (draft && published && published.publishedAt) {

    const stamp   = draft.savedAt || localStorage.getItem(DRAFT_AT_KEY) || "";
    const draftAt = Date.parse(stamp) || 0;
    const fileAt  = Date.parse(published.publishedAt) || 0;

    if (draftAt < fileAt) {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_AT_KEY);
      draft = null;
    }
  }

  if (draft && draft.products) {
    document.addEventListener("DOMContentLoaded", () => {
      const bar = document.getElementById("draftBar");
      if (bar) bar.hidden = false;
    });
    return draft;
  }

  return published;
}

if (!window.STORE_DATA) {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML =
      "<p style='padding:60px;font-family:sans-serif'>" +
      "store-data.js is missing from this folder. The shop cannot load without it." +
      "</p>";
  });
}

// let, not const: the admin can change the store while this page is open
// and we swap these out underneath the renderers rather than reloading.
let STORE = loadStore() || { products: [], categories: [], content: {}, contact: {}, brand: {} };

let products = STORE.products;
let categories = STORE.categories;

// ==========================================
// OSAMA GARMENTS - STOREFRONT
// ==========================================




// ==========================================
// STATE
// ==========================================

// A corrupt cart in localStorage used to throw here, which killed the whole
// script - blank shop, no products, nothing clickable. Now a bad cart is
// simply thrown away and the shop loads.
let cart = (function () {
  try {
    const saved = JSON.parse(localStorage.getItem("osamaCart"));
    return Array.isArray(saved) ? saved : [];
  } catch (err) {
    localStorage.removeItem("osamaCart");
    return [];
  }
})();

let currentProduct = null;

let selectedSize = "M";
let selectedColor = "";

let currentFilter = "All";


// ==========================================
// ELEMENTS
// ==========================================

const productsContainer = document.getElementById("products");

const cartDrawer = document.getElementById("cartDrawer");
const cartBtn = document.getElementById("cartBtn");
const closeCart = document.getElementById("closeCart");
const overlay = document.getElementById("overlay");

const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const cartFooter = document.getElementById("cartFooter");
const cartEmpty = document.getElementById("cartEmpty");

const productModal = document.getElementById("productModal");
const modalClose = document.getElementById("modalClose");

const checkoutModal = document.getElementById("checkoutModal");
const checkoutClose = document.getElementById("checkoutClose");


// ==========================================
// PRICE FORMAT
// ==========================================

function formatPrice(price) {
  return "Rs. " + price.toLocaleString("en-PK");
}


// ==========================================
// SITE CONTENT (from store-data.js / admin draft)
// ==========================================

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

function setImage(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.src = value;
}


function renderSiteContent() {

  const c = STORE.content || {};
  const brand = STORE.brand || {};
  const contact = STORE.contact || {};

  if (c.pageTitle) document.title = c.pageTitle;

  const meta = document.querySelector('meta[name="description"]');
  if (meta && c.metaDescription) meta.setAttribute("content", c.metaDescription);

  document.querySelectorAll('[data-brand="name"]').forEach(el => {
    if (brand.name) el.textContent = brand.name;
  });

  document.querySelectorAll('[data-brand="tagline"]').forEach(el => {
    if (brand.tagline) el.textContent = brand.tagline;
  });

  // the announcement element id and its data key differ
  setText("announcementText", c.announcement);

  [
    "heroEyebrow", "heroTitle", "heroTitleAccent", "heroText",
    "catEyebrow", "catTitle", "catText",
    "shopEyebrow", "shopTitle", "shopText",
    "bannerEyebrow", "bannerTitleA", "bannerTitleB", "bannerText",
    "storyEyebrow", "storyTitle", "storyP1", "storyP2",
    "newsEyebrow", "newsTitle", "newsText",
    "footerDescription", "footerLocation", "footerCopyright"
  ].forEach(id => setText(id, c[id]));

  setImage("heroImage", c.heroImage);
  setImage("storyImage", c.storyImage);

  buildHeroSlideshow(c.heroImages, c.heroFocus);
  buildLookbook(c.lookbook);

  const email = document.getElementById("contactEmail");

  if (email && contact.email) {
    email.textContent = contact.email;
    email.href = "mailto:" + contact.email;
  }

  const phone = document.getElementById("contactPhone");

  if (phone && contact.phoneDisplay) {
    phone.textContent = contact.phoneDisplay;
    phone.href = "tel:" + (contact.phoneDial || contact.phoneDisplay);
  }

  const whatsapp = document.getElementById("contactWhatsapp");

  if (whatsapp && contact.whatsapp) {
    whatsapp.href = "https://wa.me/" + contact.whatsapp;
  }
}


// The main display can hold several photos and move through them.
// One photo, or none, and it stays a plain image.

// A big empty hanger where a man should be looks broken, so any photo of a
// person falls back to a real hosted one before it gives up. Only if THAT
// fails too does the hanger show.
function photoFallback(img, index) {

  const list = (STORE.content && STORE.content.photoFallbacks) || [];

  // a different stand-in per slot, so four failures do not become the
  // same man four times over
  const url = list.length ? list[(index || 0) % list.length] : "";

  img.addEventListener("error", () => {

    if (url && img.dataset.fellBack !== "1") {
      img.dataset.fellBack = "1";
      img.style.objectPosition = "center 15%";
      img.src = url;
      return;
    }

    img.classList.add("img-failed");
  });
}


function buildHeroSlideshow(images, focus) {

  const frame = document.querySelector(".hero-image");

  if (!frame || !Array.isArray(images) || images.length < 2) return;

  // This can run again when the admin changes something. Rebuilding an
  // unchanged slideshow would restart it mid-fade, so bail out early -
  // and when it HAS changed, clear the old slides and old timer first.
  const key = JSON.stringify([images, focus]);
  if (frame.dataset.heroKey === key) return;
  frame.dataset.heroKey = key;

  clearInterval(frame._heroTimer);
  frame.querySelectorAll(".hero-slide").forEach(el => el.remove());
  const oldDots = frame.querySelector(".hero-dots");
  if (oldDots) oldDots.remove();

  // Each photo is framed differently, so each slide gets its own focal point -
  // one shared value either cuts a head off or leaves a metre of empty sky.
  const focusFor = i =>
    (Array.isArray(focus) && focus[i]) ? focus[i] : "center";

  const single = document.getElementById("heroImage");
  if (single) single.remove();

  const brand = (STORE.brand && STORE.brand.name) || "the collection";

  const slides = images.map((src, i) => {

    const img = document.createElement("img");

    img.className = "hero-slide" + (i === 0 ? " is-on" : "");
    img.src = src;
    img.alt = i === 0 ? "A man wearing " + brand : "";
    img.loading = i === 0 ? "eager" : "lazy";

    img.style.objectPosition = focusFor(i);

    photoFallback(img, i);

    frame.appendChild(img);

    return img;
  });

  const dots = document.createElement("div");
  dots.className = "hero-dots";

  const buttons = images.map((_, i) => {

    const dot = document.createElement("button");

    dot.type = "button";
    dot.className = "hero-dot" + (i === 0 ? " is-on" : "");
    dot.setAttribute("aria-label", "Show photo " + (i + 1) + " of " + images.length);

    dot.addEventListener("click", () => {
      show(i);
      restart();
    });

    dots.appendChild(dot);

    return dot;
  });

  frame.appendChild(dots);

  let current = 0;
  let timer = null;

  function show(next) {

    current = (next + slides.length) % slides.length;

    slides.forEach((s, i) => s.classList.toggle("is-on", i === current));
    buttons.forEach((b, i) => b.classList.toggle("is-on", i === current));
  }

  function restart() {

    clearInterval(timer);

    // someone who asked for less motion gets to drive it themselves
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    timer = setInterval(() => {
      if (!document.hidden) show(current + 1);
    }, 5200);

    frame._heroTimer = timer;
  }

  restart();
}


// ==========================================
// CATEGORIES + FILTER BUTTONS
// ==========================================

// ==========================================
// LOOKBOOK
//
// A sideways strip of looks. Each panel is a photo with a card of
// copy over it, plus the real products from the shop so a look is
// something you can actually buy rather than just look at.
// ==========================================

function buildLookbook(looks) {

  const section = document.getElementById("lookbook");
  const track   = document.getElementById("lookbookTrack");

  if (!section || !track) return;

  // nothing to show - hide the section rather than leaving an empty band.
  // Hidden, not removed: the admin may add looks back while this page is open.
  if (!Array.isArray(looks) || !looks.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  // same looks as last time - leave the strip where the visitor scrolled it
  const key = JSON.stringify(looks);
  if (track.dataset.lookKey === key) return;
  track.dataset.lookKey = key;

  track.innerHTML = "";

  looks.forEach((look, index) => {

    const panel = document.createElement("article");
    panel.className = "look";

    const photo = document.createElement("img");
    photo.className = "look-photo";
    photo.src = look.image || "";
    photo.alt = look.title || "Look " + (index + 1);
    photo.loading = index === 0 ? "eager" : "lazy";
    photo.style.objectPosition = look.focus || "center";
    photoFallback(photo, index);
    panel.appendChild(photo);

    if (look.number) {
      const num = document.createElement("p");
      num.className = "look-number";
      num.textContent = look.number;
      panel.appendChild(num);
    }

    const card = document.createElement("div");
    card.className = "look-card";

    card.innerHTML =
      "<h3>" + escapeHtml(look.title || "") + "</h3>" +
      "<p>" + escapeHtml(look.text || "") + "</p>" +
      (look.sizes ? '<div class="look-sizes">' + escapeHtml(look.sizes) + "</div>" : "");

    // the pieces in this look, pulled live from the catalogue so a
    // price change in the admin shows up here too
    const picks = (look.products || [])
      .map(id => products.find(p => p.id === id))
      .filter(Boolean);

    if (picks.length) {

      const row = document.createElement("div");
      row.className = "look-products";

      picks.forEach(product => {

        const item = document.createElement("button");
        item.type = "button";
        item.className = "look-product";

        item.innerHTML =
          '<img src="' + product.image + '" alt="" loading="lazy" ' +
          "onerror=\"this.classList.add('img-failed')\">" +
          "<span>" + escapeHtml(product.name) +
          "<small>" + formatPrice(product.price) + "</small></span>";

        item.addEventListener("click", () => openProduct(product.id));

        row.appendChild(item);
      });

      card.appendChild(row);
    }

    if (look.category) {

      const shop = document.createElement("button");
      shop.type = "button";
      shop.className = "look-shop";
      shop.textContent = "Shop " + look.category;

      shop.addEventListener("click", () => {
        setActiveFilter(look.category);
        if (searchQuery) applySearch("");
        renderProducts();
        scrollToShop();
      });

      card.appendChild(shop);
    }

    panel.appendChild(card);
    track.appendChild(panel);
  });

  // listeners survive a re-render of the panels, so only attach them once
  if (!track.dataset.wired) {
    track.dataset.wired = "1";
    wireLookbookControls(track);
  }

  track.dispatchEvent(new Event("scroll"));
}


function wireLookbookControls(track) {

  const prev = document.getElementById("lookPrev");
  const next = document.getElementById("lookNext");
  const bar  = document.getElementById("lookbookBar");

  const step = () => {
    const panel = track.querySelector(".look");
    return panel ? panel.offsetWidth + 24 : track.clientWidth * .8;
  };

  const maxScroll = () => track.scrollWidth - track.clientWidth;

  function update() {

    const max = maxScroll();

    if (bar) bar.style.width = (max <= 1 ? 100 : (track.scrollLeft / max) * 100) + "%";

    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max - 2;
  }

  const glide = amount =>
    track.scrollBy({ left: amount, behavior: "smooth" });

  if (prev) prev.addEventListener("click", () => glide(-step()));
  if (next) next.addEventListener("click", () => glide(step()));

  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  // Wheel: turn a vertical scroll into a sideways one, one look per
  // gesture. Nudging scrollLeft by the raw delta does not work here -
  // mandatory snap drags it straight back to the panel it started on -
  // so we glide a whole panel and lock until that settles.
  //
  // At either end the event is left alone so the page carries on down.
  // A strip that swallows the wheel is the fastest way to make a page
  // feel broken.
  let wheelLock = 0;

  track.addEventListener("wheel", event => {

    if (event.ctrlKey) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (!delta) return;

    const max = maxScroll();
    const atStart = track.scrollLeft <= 1;
    const atEnd   = track.scrollLeft >= max - 1;

    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

    event.preventDefault();

    const now = Date.now();
    if (now < wheelLock) return;
    wheelLock = now + 420;

    glide(delta > 0 ? step() : -step());

  }, { passive: false });

  // Click and drag, the way you would push a printed spread across a desk.
  //
  // The dragging class is only added once the pointer has actually
  // travelled - it switches pointer events off inside the track, and
  // adding it on pointerdown would mean every plain click landed on the
  // track instead of the button under the finger.
  let down = false, startX = 0, startLeft = 0, moved = 0;
  const DRAG_START = 6;

  track.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") return;   // let the browser do touch
    down = true;
    moved = 0;
    startX = event.clientX;
    startLeft = track.scrollLeft;
  });

  track.addEventListener("pointermove", event => {

    if (!down) return;

    const dx = event.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));

    if (moved <= DRAG_START) return;

    track.classList.add("is-dragging");
    track.scrollLeft = startLeft - dx;
  });

  const release = () => {
    if (!down) return;
    down = false;
    track.classList.remove("is-dragging");
  };

  track.addEventListener("pointerup", release);
  track.addEventListener("pointercancel", release);
  track.addEventListener("pointerleave", release);

  // a drag that ends on a product should not also count as a click
  track.addEventListener("click", event => {
    if (moved > DRAG_START) {
      event.preventDefault();
      event.stopPropagation();
      moved = 0;
    }
  }, true);

  track.addEventListener("keydown", event => {
    if (event.key === "ArrowRight") { event.preventDefault(); glide(step()); }
    if (event.key === "ArrowLeft")  { event.preventDefault(); glide(-step()); }
  });

  update();
}


function renderCategories() {

  const grid = document.getElementById("categoryGrid");

  if (grid) {

    grid.innerHTML = "";

    categories.forEach(category => {

      const button = document.createElement("button");

      button.className = "category-card";
      button.dataset.category = category.name;

      button.innerHTML = `
        <img src="${category.image}" alt="${escapeHtml(category.name)}"
             loading="lazy" onerror="this.classList.add('img-failed')">
        <span>${escapeHtml(category.name)}</span>
      `;

      button.addEventListener("click", () => {

        setActiveFilter(category.name);

        if (searchQuery) applySearch("");

        renderProducts();
        scrollToShop();
      });

      grid.appendChild(button);
    });
  }

  const filters = document.getElementById("filters");

  if (filters) {

    filters.innerHTML = "";

    ["All"].concat(categories.map(c => c.name)).forEach(name => {

      const button = document.createElement("button");

      button.className = "filter" + (name === "All" ? " active" : "");
      button.dataset.filter = name;
      button.textContent = name;

      button.addEventListener("click", () => {

        setActiveFilter(name);

        if (searchQuery) applySearch("");

        renderProducts();
      });

      filters.appendChild(button);
    });
  }

  const footerLinks = document.getElementById("footerShopLinks");

  if (footerLinks) {

    footerLinks.innerHTML = categories.map(category =>
      `<a href="#shop">${escapeHtml(category.name)}</a>`
    ).join("");
  }
}


// ==========================================
// RENDER PRODUCTS
// ==========================================

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}


function getSearchValue() {
  return searchQuery;
}


function matchesSearch(product, query) {

  const haystack = [
    product.name,
    product.category,
    product.description,
    product.tag,
    (product.colors || []).join(" "),
    (product.sizes || []).join(" ")
  ].join(" ").toLowerCase();

  // every word typed must appear somewhere ("black hoodie" works)
  return query
    .split(/\s+/)
    .every(word => haystack.includes(word));
}


function renderProducts() {

  const searchValue = getSearchValue();

  let filteredProducts;

  if (searchValue) {
    // A search always looks at the WHOLE store, never just the
    // category that happens to be selected.
    filteredProducts = products.filter(
      product => matchesSearch(product, searchValue)
    );
  } else if (currentFilter !== "All") {
    filteredProducts = products.filter(
      product => product.category === currentFilter
    );
  } else {
    filteredProducts = products;
  }

  updateSearchStatus(searchValue, filteredProducts.length);

  productsContainer.innerHTML = "";

  if (filteredProducts.length === 0) {

    productsContainer.innerHTML = `
      <div class="no-results">
        <h3>Nothing matched "${escapeHtml(searchValue)}"</h3>
        <p>Try a different word, or browse the full collection.</p>
        <button class="empty-clear" onclick="clearSearch()">
          Clear search
        </button>
      </div>
    `;

    return;
  }

  filteredProducts.forEach(product => {

    const card = document.createElement("article");

    card.className = "product-card";

    // Everything below is written by hand in the admin, so it has to be
    // escaped. A name like  Men's 26" Slim Shirt  used to end the alt
    // attribute early and scramble the rest of the card.
    card.innerHTML = `
      <div class="product-image">

        <img
          src="${escapeHtml(product.image || "")}"
          alt="${escapeHtml(product.name || "")}"
          loading="lazy"
          onerror="this.classList.add('img-failed')"
        >

        ${product.tag ? `<span class="product-tag">
          ${escapeHtml(product.tag)}
        </span>` : ""}

        <button
          class="quick-view"
          onclick="openProduct(${product.id})"
        >
          QUICK VIEW
        </button>

      </div>

      <div class="product-info">

        <p class="product-category">
          ${escapeHtml(product.category || "")}
        </p>

        <h3>${escapeHtml(product.name || "")}</h3>

        <div class="product-price">
          ${formatPrice(product.price)}
        </div>

        <div class="product-actions">

          <button
            class="add-btn"
            onclick="quickAdd(${product.id})"
          >
            ADD TO CART
          </button>

          <button
            class="wishlist"
            onclick="toggleWishlist(this)"
            aria-label="Add to wishlist"
            aria-pressed="false"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20.3 C 5.4 16.2 2.6 12.6 2.6 9.2 A 4.6 4.6 0 0 1 12 6.9
                       A 4.6 4.6 0 0 1 21.4 9.2 C 21.4 12.6 18.6 16.2 12 20.3 Z"/>
            </svg>
          </button>

        </div>

      </div>
    `;

    productsContainer.appendChild(card);
  });
}


// ==========================================
// QUICK ADD
// ==========================================

function quickAdd(id) {

  const product = products.find(p => p.id === id);

  if (!product) return;

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const colors = Array.isArray(product.colors) ? product.colors : [];

  // "M" only if the product actually comes in M
  const size = sizes.includes("M") ? "M" : (sizes[0] || "One size");

  addToCart(product, size, colors[0] || "");

  openCart();
}


// ==========================================
// ADD TO CART
// ==========================================

function addToCart(product, size = "M", color = "") {

  const existing = cart.find(
    item =>
      item.id === product.id &&
      item.size === size &&
      item.color === color
  );

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size,
      color,
      quantity: 1
    });
  }

  saveCart();

  updateCart();

  showToast("Added to cart");
}


// ==========================================
// SAVE CART
// ==========================================

function saveCart() {
  try {
    localStorage.setItem("osamaCart", JSON.stringify(cart));
  } catch (err) {
    /* private mode or storage full - the cart still works for this visit */
  }
}


// A cart saved weeks ago kept the price it was added at, so a customer
// coming back could send a WhatsApp order at last month's price - and a
// product deleted since then stayed in their cart for ever. Every line is
// now checked against the shop as it is right now.
function refreshCart() {

  if (!cart.length) return;

  cart = cart.filter(item => {

    const live = products.find(p => p.id === item.id);

    if (!live) return false;

    item.name = live.name;
    item.price = live.price;
    item.image = live.image;

    return true;
  });

  saveCart();
}


// ==========================================
// UPDATE CART
// ==========================================

function updateCart() {

  const count = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  cartCount.textContent = count;

  cartItems.innerHTML = "";

  if (cart.length === 0) {

    cartEmpty.classList.add("show");
    cartFooter.style.display = "none";

    return;
  }

  cartEmpty.classList.remove("show");
  cartFooter.style.display = "block";

  let total = 0;

  cart.forEach((item, index) => {

    total += item.price * item.quantity;

    const div = document.createElement("div");

    div.className = "cart-item";

    div.innerHTML = `
      <img src="${escapeHtml(item.image || "")}" alt="${escapeHtml(item.name || "")}">

      <div class="cart-item-info">

        <h4>${escapeHtml(item.name || "")}</h4>

        <p>
          Size: ${escapeHtml(item.size || "")}
          ${item.color ? ` · ${escapeHtml(item.color)}` : ""}
        </p>

        <strong>${formatPrice(item.price)}</strong>

        <div class="qty">

          <button onclick="changeQuantity(${index}, -1)">
            −
          </button>

          <span>${item.quantity}</span>

          <button onclick="changeQuantity(${index}, 1)">
            +
          </button>

        </div>

      </div>

      <button
        class="remove-item"
        onclick="removeItem(${index})"
      >
        ✕
      </button>
    `;

    cartItems.appendChild(div);
  });

  cartTotal.textContent = formatPrice(total);
}


// ==========================================
// QUANTITY
// ==========================================

function changeQuantity(index, change) {

  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  saveCart();
  updateCart();
}


// ==========================================
// REMOVE ITEM
// ==========================================

function removeItem(index) {

  cart.splice(index, 1);

  saveCart();
  updateCart();
}


// ==========================================
// CART OPEN / CLOSE
// ==========================================

// With the cart or a modal open, the page behind used to keep scrolling
// under your finger - on a phone that reads as the site being broken.
// One place decides it, so nothing can leave the page locked.
function lockScroll() {

  const open =
    cartDrawer.classList.contains("open") ||
    productModal.classList.contains("open") ||
    checkoutModal.classList.contains("open");

  document.body.style.overflow = open ? "hidden" : "";
}


function openCart() {

  cartDrawer.classList.add("open");
  overlay.classList.add("open");

  lockScroll();
}

function closeCartDrawer() {

  cartDrawer.classList.remove("open");
  overlay.classList.remove("open");

  lockScroll();
}

cartBtn.addEventListener("click", openCart);

closeCart.addEventListener("click", closeCartDrawer);

overlay.addEventListener("click", closeCartDrawer);


// ==========================================
// PRODUCT MODAL
// ==========================================

function openProduct(id) {

  currentProduct = products.find(p => p.id === id);

  // A product saved without sizes or colours used to stop this function
  // dead, so Quick View did nothing at all.
  if (!currentProduct) return;

  if (!Array.isArray(currentProduct.sizes)) currentProduct.sizes = [];
  if (!Array.isArray(currentProduct.colors)) currentProduct.colors = [];

  selectedSize = currentProduct.sizes[0] || "";
  selectedColor = currentProduct.colors[0] || "";

  document.getElementById("modalImage").src =
    currentProduct.image;

  document.getElementById("modalImage").alt =
    currentProduct.name;

  document.getElementById("modalCategory").textContent =
    currentProduct.category;

  document.getElementById("modalName").textContent =
    currentProduct.name;

  document.getElementById("modalPrice").textContent =
    formatPrice(currentProduct.price);

  document.getElementById("modalDescription").textContent =
    currentProduct.description;

  renderSizes();
  renderColors();

  productModal.classList.add("open");
}


function renderSizes() {

  const container = document.getElementById("modalSizes");

  container.innerHTML = "";

  currentProduct.sizes.forEach(size => {

    const button = document.createElement("button");

    button.className =
      "size-btn " +
      (size === selectedSize ? "selected" : "");

    button.textContent = size;

    button.onclick = () => {

      selectedSize = size;

      renderSizes();
    };

    container.appendChild(button);
  });
}


function renderColors() {

  const container = document.getElementById("modalColors");

  container.innerHTML = "";

  currentProduct.colors.forEach(color => {

    const button = document.createElement("button");

    button.className =
      "color-btn " +
      (color === selectedColor ? "selected" : "");

    button.textContent = color;

    button.onclick = () => {

      selectedColor = color;

      renderColors();
    };

    container.appendChild(button);
  });
}


function closeProductModal() {
  productModal.classList.remove("open");
  lockScroll();
}

modalClose.addEventListener("click", closeProductModal);

// Clicking the dark area around a modal now closes it, the way every
// other site behaves. Clicks inside the white box are left alone.
productModal.addEventListener("click", event => {
  if (event.target === productModal) closeProductModal();
});


// Add from product modal

document.getElementById("modalAdd").addEventListener("click", () => {

  addToCart(
    currentProduct,
    selectedSize,
    selectedColor
  );

  productModal.classList.remove("open");

  openCart();
});


// ==========================================
// CHECKOUT
// ==========================================

document
  .getElementById("checkoutBtn")
  .addEventListener("click", () => {

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    document.getElementById("checkoutTotal").textContent =
      formatPrice(total);

    checkoutModal.classList.add("open");

    lockScroll();
  });


function closeCheckoutModal() {
  checkoutModal.classList.remove("open");
  lockScroll();
}

checkoutClose.addEventListener("click", closeCheckoutModal);

checkoutModal.addEventListener("click", event => {
  if (event.target === checkoutModal) closeCheckoutModal();
});


// Escape closes whatever is on top, one layer at a time.
document.addEventListener("keydown", event => {

  if (event.key !== "Escape") return;

  if (checkoutModal.classList.contains("open")) return closeCheckoutModal();
  if (productModal.classList.contains("open")) return closeProductModal();
  if (cartDrawer.classList.contains("open")) return closeCartDrawer();

  const panel = document.getElementById("searchPanel");

  if (panel && panel.classList.contains("open")) {
    applySearch("");
    panel.classList.remove("open");
    return;
  }

  const menu = document.getElementById("mobileMenu");
  if (menu && menu.classList.contains("open")) menu.classList.remove("open");
});


// ==========================================
// PLACE ORDER
// ==========================================

// Orders go straight to the shop's WhatsApp, fully written out.
const WHATSAPP_NUMBER = (STORE.contact && STORE.contact.whatsapp) || "923144264131";
const SHOP_EMAIL = (STORE.contact && STORE.contact.email) || "";


function buildOrderMessage(order) {

  const lines = [];

  lines.push("*NEW ORDER - " + ((STORE.brand && STORE.brand.name) || "OSAMA GARMENTS").toUpperCase() + "*");
  lines.push("");
  lines.push("*Items*");

  order.products.forEach((item, index) => {

    const details = ["Size " + item.size];

    if (item.color) details.push(item.color);

    details.push("Qty " + item.quantity);

    lines.push(`${index + 1}. ${item.name}`);
    lines.push(
      "   " + details.join(" / ") +
      " - " + formatPrice(item.price * item.quantity)
    );
  });

  lines.push("");
  lines.push("*Order total:* " + formatPrice(order.total));
  lines.push("*Payment:* " + order.payment);
  lines.push("");
  lines.push("*Customer*");
  lines.push("Name: " + order.customer.name);
  lines.push("Phone: " + order.customer.phone);

  if (order.customer.email) {
    lines.push("Email: " + order.customer.email);
  }

  lines.push("Address: " + order.customer.address);

  return lines.join("\n");
}


document
  .getElementById("checkoutForm")
  .addEventListener("submit", function(e) {

    e.preventDefault();

    if (cart.length === 0) return;

    const formData = new FormData(this);

    const order = {
      customer: {
        name: formData.get("name").trim(),
        phone: formData.get("phone").trim(),
        email: (formData.get("email") || "").trim(),
        address: formData.get("address").trim()
      },

      payment: formData.get("payment"),

      products: cart,

      total: cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),

      createdAt: new Date().toISOString()
    };

    // Keep a local record so the order isn't lost if WhatsApp fails to open,
    // and so admin.html can list it.
    order.id = "OG-" + Date.now().toString(36).toUpperCase();
    order.status = "New";

    try {
      const previous = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      previous.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(previous.slice(0, 200)));
    } catch (err) {
      /* storage full or blocked - the WhatsApp message still goes out */
    }

    localStorage.setItem("lastOrder", JSON.stringify(order));

    const url =
      "https://wa.me/" + WHATSAPP_NUMBER +
      "?text=" + encodeURIComponent(buildOrderMessage(order));

    // NB: passing "noopener" as a feature makes window.open return null,
    // which would make every successful open look like a blocked popup.
    const opened = window.open(url, "_blank");

    if (opened) {
      try { opened.opener = null; } catch (err) { /* cross-origin, fine */ }
    }

    const message = document.getElementById("orderMessage");

    if (opened) {

      message.innerHTML =
        "&#10003; Your order is open in WhatsApp - press send and we'll confirm it.";

    } else {

      // Popup blocked: give them a link they can click themselves.
      message.innerHTML =
        `Your browser blocked the WhatsApp window.
         <a href="${url}" target="_blank" rel="noopener">
           Tap here to send your order
         </a>
         or email it to ${SHOP_EMAIL}.`;
    }

    this.reset();

    cart = [];

    saveCart();
    updateCart();

    if (opened) {
      setTimeout(() => {

        checkoutModal.classList.remove("open");
        closeCartDrawer();

        message.innerHTML = "";

      }, 4000);
    }
  });


// ==========================================
// SEARCH
// ==========================================

const searchPanel  = document.getElementById("searchPanel");
const searchStatus = document.getElementById("searchStatus");

// Two boxes, one search: the magnifier in the header and the
// always-visible box in the shop section stay in sync.
const searchInputs = [
  document.getElementById("searchInput"),
  document.getElementById("shopSearchInput")
].filter(Boolean);

const searchClears = [
  document.getElementById("searchClear"),
  document.getElementById("shopSearchClear")
].filter(Boolean);

let searchQuery = "";
let hadQuery = false;


// Show "3 results for ..." right above the product grid,
// where the person is actually looking.
function updateSearchStatus(query, count) {

  if (!searchStatus) return;

  if (!query) {
    searchStatus.classList.remove("show");
    searchStatus.innerHTML = "";
    return;
  }

  searchStatus.classList.add("show");

  searchStatus.innerHTML = `
    <span>
      <b>${count}</b> ${count === 1 ? "result" : "results"}
      for <b>"${escapeHtml(query)}"</b>
    </span>

    <button type="button" onclick="clearSearch()">
      Clear search
    </button>
  `;
}


function setActiveFilter(name) {

  currentFilter = name;

  document.querySelectorAll(".filter").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === name);
  });
}


// Results live below the header search box, so bring them into view
// the moment a search starts there — otherwise typing looks like
// nothing happened.
function scrollToShop() {

  const shop = document.getElementById("shop");

  window.scrollTo({
    top: shop.offsetTop - 90,
    behavior: "smooth"
  });
}


function applySearch(value, options = {}) {

  const { scroll = false, source = null } = options;

  searchQuery = value.toLowerCase().trim();

  // Keep every search box showing the same thing.
  searchInputs.forEach(input => {
    if (input !== source) input.value = value;
  });

  searchClears.forEach(button => {
    button.classList.toggle("show", searchQuery.length > 0);
  });

  // Searching resets the category filter, so "hoodie" still finds
  // hoodies even while the Jackets tab is selected.
  if (searchQuery && currentFilter !== "All") {
    setActiveFilter("All");
  }

  renderProducts();

  if (scroll && searchQuery && !hadQuery) {
    scrollToShop();
  }

  hadQuery = searchQuery.length > 0;
}


function clearSearch() {

  applySearch("");

  const shopBox = document.getElementById("shopSearchInput");

  if (searchPanel.classList.contains("open")) {
    document.getElementById("searchInput").focus();
  } else if (shopBox) {
    shopBox.focus();
  }
}


document.getElementById("searchBtn").addEventListener("click", () => {

  searchPanel.classList.toggle("open");

  if (searchPanel.classList.contains("open")) {
    document.getElementById("searchInput").focus();
  }
});


searchInputs.forEach(input => {

  // Only the header box scrolls down to the results; the shop box
  // is already sitting next to them.
  const shouldScroll = input.id === "searchInput";

  input.addEventListener("input", () => {
    applySearch(input.value, { scroll: shouldScroll, source: input });
  });

  input.addEventListener("keydown", event => {

    if (event.key === "Enter") {
      event.preventDefault();
      if (searchQuery && shouldScroll) scrollToShop();
    }

    if (event.key === "Escape") {
      applySearch("");
      searchPanel.classList.remove("open");
    }
  });
});


searchClears.forEach(button => {
  button.addEventListener("click", clearSearch);
});


// ==========================================
// MOBILE MENU
// ==========================================

document.getElementById("menuBtn").addEventListener("click", () => {

  document
    .getElementById("mobileMenu")
    .classList.toggle("open");
});


// ==========================================
// WISHLIST
// ==========================================

function toggleWishlist(button) {

  const saved = button.classList.toggle("saved");

  button.setAttribute("aria-pressed", saved ? "true" : "false");

  button.setAttribute(
    "aria-label",
    saved ? "Remove from wishlist" : "Add to wishlist"
  );
}


// ==========================================
// NEWSLETTER
// ==========================================

document
  .getElementById("newsletterForm")
  .addEventListener("submit", function(e) {

    e.preventDefault();

    document.getElementById("newsletterMessage").textContent =
      "\u2713 Thank you \u2014 we'll message you when new pieces land.";

    this.reset();
  });


// ==========================================
// START SHOPPING
// ==========================================

document
  .getElementById("startShopping")
  .addEventListener("click", () => {

    closeCartDrawer();

    document
      .getElementById("shop")
      .scrollIntoView();
  });


// ==========================================
// TOAST
// ==========================================

function showToast(message) {

  const toast = document.createElement("div");

  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "25px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#14212C";
  toast.style.color = "white";
  toast.style.padding = "12px 22px";
  toast.style.zIndex = "300";
  toast.style.fontSize = "13px";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 1800);
}


// ==========================================
// INITIALIZE
// ==========================================

renderSiteContent();
renderCategories();
renderProducts();

refreshCart();
updateCart();


// ==========================================
// LIVE SYNC WITH THE ADMIN
//
// The admin saves its draft into this browser on every keystroke and
// every delete. This page used to read that draft once, at load, so a
// change - a deletion most of all - only showed up after a refresh.
//
// Now the page watches the draft and redraws itself the moment it
// moves. It costs two localStorage reads a second, which is nothing.
// ==========================================

// A stamp that changes whenever the shop's content changes: the draft's
// save time while a draft exists, the file's publish time otherwise.
// Comparing this is far cheaper than comparing the whole store.
function storeStamp() {

  const hasDraft = !!localStorage.getItem(DRAFT_KEY);

  if (hasDraft) return "draft:" + (localStorage.getItem(DRAFT_AT_KEY) || "");

  return "file:" + ((window.STORE_DATA && window.STORE_DATA.publishedAt) || "");
}


let lastStamp = storeStamp();


function applyStore(next) {

  STORE = next || { products: [], categories: [], content: {}, contact: {}, brand: {} };

  products = STORE.products || [];
  categories = STORE.categories || [];

  const bar = document.getElementById("draftBar");
  if (bar) bar.hidden = !localStorage.getItem(DRAFT_KEY);

  // a product that has just been deleted should not stay open on screen
  if (currentProduct && !products.some(p => p.id === currentProduct.id)) {
    currentProduct = null;
    productModal.classList.remove("open");
    // was .remove("show") - the overlay's class is "open", so this line
    // did nothing and the dark layer could stay up with nothing behind it
    overlay.classList.remove("open");
    lockScroll();
  }

  // a filter pointing at a category that no longer exists would show nothing
  if (currentFilter !== "All" && !categories.some(c => c.name === currentFilter)) {
    setActiveFilter("All");
  }

  renderSiteContent();
  renderCategories();
  renderProducts();

  refreshCart();
  updateCart();
}


function syncFromAdmin() {

  const stamp = storeStamp();

  if (stamp === lastStamp) return;

  lastStamp = stamp;

  applyStore(loadStore());
}


// Fires in every OTHER tab the moment the admin writes - so with the
// admin in one tab and the shop in another, this is instant.
window.addEventListener("storage", event => {
  if (!event.key || event.key === DRAFT_KEY || event.key === DRAFT_AT_KEY) syncFromAdmin();
});

// Covers coming back to the shop tab, and the storage event not firing
// when both pages are the same tab's history.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncFromAdmin();
});

window.addEventListener("pageshow", syncFromAdmin);
window.addEventListener("focus", syncFromAdmin);

// The backstop. Some browsers are unreliable about the storage event on
// file:// pages, and this makes the shop right within a second regardless.
setInterval(syncFromAdmin, 1000);


const discardDraft = document.getElementById("draftDiscard");

if (discardDraft) {
  discardDraft.addEventListener("click", () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_AT_KEY);
    syncFromAdmin();
  });
}
