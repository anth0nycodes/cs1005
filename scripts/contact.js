const contactForm = document.querySelector(".contact-form");
const formStatus = document.querySelector("#form-status");
const orderDetails = document.querySelector("#order-details");

// Request types that don't involve picking anything up
const NO_PICKUP_REQUESTS = ["general-question"];

// Email: some text, an "@", a domain name, a dot, then an ending of at least
// 2 characters (like "name@example.com"). No spaces, and only one "@".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Name: only letters (including accented ones like "é"), spaces, apostrophes,
// periods, and hyphens, so names like "Mary-Jane O'Neil Jr." are allowed.
// Both straight (') and curly (’) apostrophes count, since iPhone keyboards
// type the curly one.
const NAME_PATTERN = /^[\p{L}'’ .-]+$/u;

// Pickup hours, matching the hours listed on the page
const WEEKDAY_HOURS = {
  open: "06:00",
  close: "20:00",
  message: "On weekdays, pickup is between 6 a.m. and 8 p.m.",
};
const SATURDAY_HOURS = {
  open: "08:00",
  close: "18:00",
  message: "On Saturdays, pickup is between 8 a.m. and 6 p.m.",
};

// Indexed by Date.getDay() (0 = Sunday). null means closed.
const PICKUP_HOURS = [
  null,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  WEEKDAY_HOURS,
  SATURDAY_HOURS,
];

/* Date helpers */

/**
 * Parses a date input value as local midnight (new Date("2026-11-03") would be UTC).
 * @param value - "YYYY-MM-DD"
 * @returns the parsed date
 */
function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day); // month - 1 because Date counts months from 0
}

/**
 * Gets today's date at local midnight.
 * @returns today at midnight
 */
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Formats a date the way a date input expects it.
 * @param date
 * @returns "YYYY-MM-DD"
 */
function toDateInputValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Gets the current time the way a time input formats it.
 * @returns "HH:MM"
 */
function currentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/* Validators */

/**
 * Checks a value's length against a minimum and/or maximum.
 * @param value
 * @param rules
 * @returns error message, or "" when valid
 */
function validateLength(value, { min, max, label }) {
  if (min && value.length < min) {
    return `${label} must be at least ${min} characters (currently ${value.length}).`;
  }
  if (max && value.length > max) {
    return `${label} must be ${max} characters or fewer (currently ${value.length}).`;
  }
  return "";
}

/**
 * Validators keyed by field id. Each returns an error message, or "" when valid.
 */
const validators = {
  "full-name"(value) {
    if (!value) return "Please enter your full name.";
    if (!NAME_PATTERN.test(value)) {
      return "Name can only include letters, spaces, hyphens, periods, and apostrophes.";
    }
    return validateLength(value, { min: 2, max: 80, label: "Name" });
  },

  email(value) {
    if (!value) return "Please enter your email so we can confirm your order.";
    if (!EMAIL_PATTERN.test(value)) {
      return "Please enter a valid email, like name@example.com.";
    }
    return "";
  },

  "request-type"(value) {
    return value ? "" : "Please choose a request type.";
  },

  "pickup-date"(value) {
    if (!value) return "Please choose a pickup date.";

    const date = parseDate(value);
    if (date < startOfToday()) return "Pickup date can’t be in the past.";
    if (!PICKUP_HOURS[date.getDay()]) {
      return "We’re closed on Sundays. Please choose another day.";
    }
    return "";
  },

  "pickup-time"(value, form) {
    if (!value) return "Please choose a pickup time.";

    // Hours depend on the chosen date, since Saturday closes earlier
    const dateValue = form.elements["pickup-date"].value;
    if (!dateValue) return "";

    // A closed day is already reported on the date field
    const hours = PICKUP_HOURS[parseDate(dateValue).getDay()];
    if (!hours) return "";

    if (value < hours.open || value > hours.close) return hours.message;
    if (dateValue === toDateInputValue(new Date()) && value < currentTimeValue()) {
      return "That time has already passed today. Please choose a later time.";
    }
    return "";
  },

  "allergy-notes"(value) {
    return validateLength(value, { max: 200, label: "Allergy notes" });
  },

  "item-details"(value) {
    if (!value) return "Please tell us what you’d like to order or ask.";
    return validateLength(value, {
      min: 10,
      max: 1000,
      label: "Your message",
    });
  },
};

/* Showing and clearing errors */

/**
 * Gets the error message element for a field, creating it on first use.
 * @param field
 * @returns the error element
 */
function getErrorElement(field) {
  const id = `${field.id}-error`;
  let error = document.getElementById(id);

  if (!error) {
    error = document.createElement("p");
    error.id = id;
    error.className = "field-error";
    field.closest(".form-field").append(error);
    field.setAttribute("aria-describedby", id);
  }
  return error;
}

/**
 * Shows an error message under a field and marks it invalid.
 * @param field
 * @param message
 */
function showError(field, message) {
  getErrorElement(field).textContent = message;
  field.setAttribute("aria-invalid", "true");
}

/**
 * Clears a field's error message and invalid state.
 * @param field
 */
function clearError(field) {
  getErrorElement(field).textContent = "";
  field.removeAttribute("aria-invalid");
}

/**
 * Validates one field and shows or clears its error.
 * @param field
 * @returns true when valid
 */
function validateField(field) {
  const message = validators[field.id](field.value.trim(), contactForm);

  if (message) {
    showError(field, message);
  } else {
    clearError(field);
  }
  return message === "";
}

/**
 * Gets the fields that should be validated, skipping disabled ones.
 * matches(":disabled") also catches fields disabled by their fieldset, which field.disabled does not.
 * @returns the enabled fields
 */
function getValidatedFields() {
  return Object.keys(validators)
    .map((id) => document.getElementById(id))
    .filter((field) => !field.matches(":disabled"));
}

/* Showing only the fields a request needs */

/**
 * Shows or hides the pickup details based on the request type. Hidden details are
 * disabled so they aren't validated or submitted, but their values are kept in case
 * the shopper switches back to an order.
 */
function updateOrderDetails() {
  const requestType = contactForm.elements["request-type"].value;
  const needsPickup = !NO_PICKUP_REQUESTS.includes(requestType);

  orderDetails.hidden = !needsPickup;
  orderDetails.disabled = !needsPickup;

  if (!needsPickup) {
    orderDetails.querySelectorAll("input").forEach(clearError);
    clearStatusOnceFixed();
  }
}

/**
 * Validates every field so the shopper sees all problems at once.
 * @returns the invalid fields
 */
function validateForm() {
  return getValidatedFields().filter((field) => !validateField(field));
}

/* Event handling */

// Fields the shopper has already left once. Their errors update live while
// typing; untouched fields stay quiet until the shopper moves on.
const touchedFields = new Set();

/**
 * Validates a field when the shopper leaves it, unless it was skipped while empty.
 * @param event
 */
function handleFieldExit(event) {
  const field = event.target;
  if (!validators[field.id]) return;

  // Tabbing past an empty field the shopper hasn't touched yet shouldn't show an error
  const isEmpty = field.value.trim() === "";
  if (isEmpty && !touchedFields.has(field)) return;

  touchedFields.add(field);
  validateField(field);
}

/**
 * Re-validates touched fields as the shopper types or picks a value.
 * @param event
 */
function handleFieldInput(event) {
  const field = event.target;
  if (!validators[field.id]) return;

  if (touchedFields.has(field)) validateField(field);

  // if the request type changes, show or hide the pickup fields
  if (field.id === "request-type") updateOrderDetails();

  // Changing the date can make an already-entered time valid or invalid
  const timeField = contactForm.elements["pickup-time"];
  if (field.id === "pickup-date" && touchedFields.has(timeField)) {
    validateField(timeField);
  }

  clearStatusOnceFixed();
}

/**
 * Shows a message under the submit button.
 * @param message
 * @param [isError=false]
 */
function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("is-error", isError);
}

/**
 * Removes the "Please fix…" summary once every highlighted field is fixed.
 */
function clearStatusOnceFixed() {
  const isShowingErrors = formStatus.classList.contains("is-error");
  if (isShowingErrors && !contactForm.querySelector("[aria-invalid='true']")) {
    setStatus("");
  }
}

/**
 * Blocks submission when fields are invalid, otherwise thanks the shopper and resets the form.
 * @param event
 */
function handleSubmit(event) {
  event.preventDefault();

  const invalidFields = validateForm();
  getValidatedFields().forEach((field) => touchedFields.add(field));

  if (invalidFields.length > 0) {
    const count = invalidFields.length;
    setStatus(`Please fix the ${count} highlighted field${count === 1 ? "" : "s"} above.`, true);
    invalidFields[0].focus();
    return;
  }

  const firstName = contactForm.elements["full-name"].value.trim().split(" ")[0];
  const email = contactForm.elements.email.value.trim();
  setStatus(
    `Thanks, ${firstName}! We got your request and will email ${email} within one business day.`,
  );

  contactForm.reset();
  touchedFields.clear();
  updateOrderDetails();
  getValidatedFields().forEach(clearError);
}

/**
 * Sets up the form and attaches event listeners.
 */
function initContactForm() {
  // Use our own messages instead of the browser's default popups.
  // The HTML required/minlength attributes still protect the form if
  // JavaScript fails to load.
  contactForm.noValidate = true;
  contactForm.elements["pickup-date"].min = toDateInputValue(new Date());
  // The browser may restore a previous request type on back/forward
  updateOrderDetails();

  contactForm.addEventListener("focusout", handleFieldExit);
  contactForm.addEventListener("input", handleFieldInput);
  contactForm.addEventListener("change", handleFieldInput);
  contactForm.addEventListener("submit", handleSubmit);
}

initContactForm();
