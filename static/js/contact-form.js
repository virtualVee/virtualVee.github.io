(() => {
  const form = document.querySelector(".contact-form");
  const feedback = document.querySelector("#contact-feedback");
  const messageField = form?.querySelector('[name="message"]');
  const counter = document.querySelector("#contact-message-count");
  if (messageField && counter) {
    const updateCounter = () => {
      counter.textContent = `${messageField.value.length}/${messageField.maxLength}`;
    };
    counter.hidden = false;
    updateCounter();
    messageField.addEventListener("input", updateCounter);
    // Reset fires before the browser restores field values.
    form.addEventListener("reset", () => setTimeout(updateCounter, 0));
    window.addEventListener("pageshow", updateCounter);
  }
  if (!form || !feedback || !form.hasAttribute("action") || !window.fetch || !window.FormData || !window.URLSearchParams || !window.AbortController) return;
  const fieldset = form.querySelector("fieldset");
  const submit = form.querySelector('button[type="submit"]');
  if (!fieldset || !submit || fieldset.disabled) return;
  const name = form.elements.namedItem("name");
  const email = form.elements.namedItem("email");
  const message = form.elements.namedItem("message");
  const honeypot = form.elements.namedItem("_gotcha");

  message.addEventListener("invalid", () => {
    if (message.value.trim().length < 10) message.setCustomValidity("Please enter at least 10 characters.");
  });

  function validateFields() {
    name.setCustomValidity(name.value.trim() ? "" : "Please enter your name.");
    message.setCustomValidity(message.value.trim().length >= 10 ? "" : "Please enter at least 10 characters.");
    const address = email.value.trim().toLowerCase();
    const domain = address.split("@")[1] || "";
    // A narrow placeholder check, not a claim that an address or mailbox exists.
    const placeholder = /(^|\.)(example\.(com|net|org)|invalid|test|localhost)$/.test(domain) || address === "test@test.com";
    email.setCustomValidity(placeholder ? "Please use an email address where I can reply, rather than an example or test address." : "");
  }
  // Clear stale errors as soon as visitors edit a field, so correction allows retry.
  for (const field of [name, email, message]) field.addEventListener("input", () => field.setCustomValidity(""));
  form.addEventListener("reset", () => {
    for (const field of [name, email, message]) field.setCustomValidity("");
  });
  const security = document.querySelector("#contact-turnstile");
  const securityStatus = document.querySelector("#contact-security-status");
  let securityToken = "";
  let widgetId;
  let resetSecurity = () => {};
  if (security) {
    const notice = text => { if (securityStatus) { securityStatus.textContent = text; securityStatus.hidden = !text; } };
    const clearSecurity = text => { securityToken = ""; notice(text); };
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onerror = () => clearSecurity("Security check could not load. Please reload or contact me on LinkedIn.");
    script.onload = () => {
      try {
        widgetId = window.turnstile.render(security, {
          sitekey: security.dataset.sitekey,
          size: "flexible",
          appearance: "interaction-only",
          theme: document.documentElement.dataset.theme || "auto",
          callback: token => { securityToken = token; notice(""); },
          "expired-callback": () => clearSecurity("Security check expired. Please complete it again."),
          "timeout-callback": () => clearSecurity("Security check timed out. Please try again."),
          "error-callback": () => clearSecurity("Security check failed. Please reload or contact me on LinkedIn."),
        });
        resetSecurity = () => {
          securityToken = "";
          notice("");
          window.turnstile.reset(widgetId);
        };
      } catch { script.onerror(); }
    };
    document.head.append(script);
  }
  let sending = false;
  form.dataset.contactMode = "inline";

  function showFeedback(state, title, message) {
    feedback.hidden = false;
    feedback.dataset.state = state;
    const icon = document.createElement("span");
    icon.className = "contact-feedback-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = state === "success" ? "✓" : state === "error" ? "!" : "…";
    const content = document.createElement("div");
    const heading = document.createElement("strong");
    heading.className = "contact-feedback-title";
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    content.append(heading, description);
    feedback.replaceChildren(icon, content);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    validateFields();
    if (!form.reportValidity()) return;
    // Do not send filled traps; the same field is also checked by Formspree without JS.
    if (honeypot && honeypot.value) return;
    if (security && !securityToken) {
      showFeedback("error", "Security check needed", "Please complete the security check before sending. If it cannot load, reload the page or contact me on LinkedIn.");
      feedback.focus();
      return;
    }
    // Capture values before disabling the fields; disabled fields are omitted from FormData.
    const body = new URLSearchParams(new FormData(form));
    if (security) body.set("cf-turnstile-response", securityToken);
    body.set("name", name.value.trim());
    body.set("email", email.value.trim());
    body.set("message", message.value.trim());
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    sending = true;
    fieldset.disabled = true;
    submit.textContent = "Sending…";
    form.setAttribute("aria-busy", "true");
    showFeedback("sending", "Sending…", "Your message is being submitted.");
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.ok === false || data.errors) throw new Error("Submission not confirmed");
      form.reset();
      showFeedback("success", "Message submitted", "Thanks—your message has been submitted.");
    } catch {
      showFeedback("error", "Submission not confirmed", "Your message is still here—please try again, or contact me on LinkedIn.");
    } finally {
      clearTimeout(timeout);
      resetSecurity();
      sending = false;
      fieldset.disabled = false;
      submit.textContent = "Send";
      form.removeAttribute("aria-busy");
      feedback.focus({preventScroll:true});
      feedback.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }
  });
})();
