/*
Handles submission of the waitlist form.

This script serialises the user's responses into JSON and posts them to a Google Apps Script endpoint that writes them into a Google Sheet. To use, replace the APPS_SCRIPT_URL with your deployed Apps Script web app URL.

Includes a hidden honeypot field to deter bots. If the honeypot contains anything, the submission is silently dropped.
*/

// URL of the deployed Google Apps Script web app that saves form submissions
// to a Google Sheet. This should be the endpoint of the Apps Script deployment.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbG5ItFb29DF0LBCe2wSCp_b7aM2jXx06qV6_FjD5eWa8-f3JzhM3fTu2V9kuyDOO4/exec';

// Wait for the DOM to be fully loaded before attaching event handlers
document.addEventListener('DOMContentLoaded', () => {
  // Grab form and status message elements safely
  const form = document.querySelector('#waitlist-form');
  const statusMessage = document.querySelector('.status-message');

  // Bail out if the form isn't present
  if (!form) {
    console.warn('Waitlist form not found in the DOM.');
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!statusMessage) return;

    // Clear any previous status
    statusMessage.textContent = '';

    // Optionally disable the submit button to prevent repeated clicks
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    // Build a plain object from the form data
    const formData = new FormData(form);
    const data = {};
    for (const [key, value] of formData.entries()) {
      const trimmed = String(value).trim();
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

    // Join multi-select/checkbox values into a comma-separated string
    if (Array.isArray(data.important)) {
      data.important = data.important.join(', ');
    }

    // Honeypot bot check: abort if the hidden field contains anything
    if (data.extra_field) {
      if (submitButton) submitButton.disabled = false;
      return;
    }

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const json = await response.json();
      if (json.ok) {
        statusMessage.textContent = "Thank you! You've been added to our waitlist.";
        form.reset();
      } else {
        statusMessage.textContent = 'Oops! There was a problem. Please try again later.';
      }
    } catch (error) {
      console.error('Error submitting waitlist form:', error);
      statusMessage.textContent = 'Something went wrong. Please try again later.';
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});
