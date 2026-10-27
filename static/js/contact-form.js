(() => {
  const form = document.querySelector(".contact-form");
  const feedback = document.querySelector("#contact-feedback");
  if (!form || !feedback || !form.hasAttribute("action") || !window.fetch || !window.FormData || !window.URLSearchParams || !window.AbortController) return;
  const fieldset = form.querySelector("fieldset");
  const submit = form.querySelector('button[type="submit"]');
  if (!fieldset || !submit || fieldset.disabled) return;
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
    if (sending || !form.reportValidity()) return;
    // Capture values before disabling the fields; disabled fields are omitted from FormData.
    const body = new URLSearchParams(new FormData(form));
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
      sending = false;
      fieldset.disabled = false;
      submit.textContent = "Send";
      form.removeAttribute("aria-busy");
      feedback.focus({preventScroll:true});
      feedback.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }
  });
})();
