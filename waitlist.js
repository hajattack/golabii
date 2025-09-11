/*
  Handles submission of the waitlist form.

  This script serialises the user's responses into JSON and posts them to a
  Google Apps Script endpoint that writes them into a Google Sheet. To use,
  replace the APPS_SCRIPT_URL with your deployed Apps Script web app URL.

  Includes a hidden honeypot field to deter bots. If the honeypot contains
  anything, the submission is silently dropped.
*/

// URL of the deployed Google Apps Script web app that saves form submissions
// to a Google Sheet. This should be the endpoint of the Apps Script deployment.
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbG5ItFb29DF0LBCe2wSCp_b7aM2jXx06qV6_FjD5eWa8-f3JzhM3fTu2V9kuyDOO4/exec";

// Helper to select elements
function $(selector) {
  return document.querySelector(selector);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("#waitlist-form");
  const statusMessage = $(".status-message");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    statusMessage.textContent = "";

    const formData = new FormData(form);
    // Build a plain object from the FormData for JSON encoding.
    // If a key appears multiple times (e.g. checkbox group), aggregate into an array.
    const data = {};
    for (const [key, value] of formData.entries()) {
      const trimmed = value.trim();
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(trimmed);
        } else {
          data[key] = [data[key], trimmed];
        }
      } else {
        data[key] = trimmed;
      }
    }
    // Convert multi-select values (checkboxes) into comma-separated strings.
    if (Array.isArray(data.important)) {
      data.important = data.important.join(", ");
    }

    // Bot check: if honeypot has content, abort silently
    if (data.extra_field) {
      return;
    }

    // POST to Apps Script
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((json) => {
        if (json.ok) {
          statusMessage.textContent =
            "Thank you! You've been added to our waitlist.";
          form.reset();
        } else {
          statusMessage.textContent =
            "Oops! There was a problem. Please try again later.";
        }
      })
      .catch(() => {
        statusMessage.textContent =
          "Something went wrong. Please try again later.";
      });
  });
});
