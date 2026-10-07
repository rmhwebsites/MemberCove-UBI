/**
 * The contact form, sent in the background so the visitor stays on the page. The same checks run
 * again in the Worker (src/worker/contact.ts); these only save a round trip. Without this script the
 * browser checks the required fields itself and posts the form normally.
 */

type Errors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

const form = document.querySelector<HTMLFormElement>("[data-contact-form]");

if (form) {
  form.noValidate = true;
  const success = document.querySelector<HTMLElement>("[data-form-success]");
  const formError = form.querySelector<HTMLElement>("[data-form-error]");
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]");
  const submitLabel = form.querySelector<HTMLElement>("[data-submit-label]");
  const fallbackEmail = document.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')?.href.replace("mailto:", "") ?? "hello@membercove.com";

  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? "";

  const clearErrors = () => {
    formError?.classList.add("hidden");
    form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
      el.textContent = "";
      el.classList.add("hidden");
    });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  };

  const showErrors = (errors: Errors) => {
    let first: HTMLElement | null = null;
    for (const [field, message] of Object.entries(errors)) {
      const slot = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
      if (slot) {
        slot.textContent = message;
        slot.classList.remove("hidden");
      }
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLElement) {
        input.setAttribute("aria-invalid", "true");
        first ??= input;
      }
    }
    first?.focus();
  };

  const showFormError = (message: string) => {
    if (!formError) return;
    formError.textContent = message;
    formError.classList.remove("hidden");
  };

  const setBusy = (busy: boolean) => {
    if (submit) submit.disabled = busy;
    if (submitLabel) submitLabel.textContent = busy ? "Sending…" : "Send message";
  };

  const check = (): Errors => {
    const errors: Errors = {};
    if (!value("name")) errors.name = "Please enter your name.";
    if (!EMAIL_PATTERN.test(value("email"))) errors.email = "Please enter a valid email address.";
    if (!value("association")) errors.association = "Please tell us your association's name.";
    return errors;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    const errors = check();
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(form),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; errors?: Errors } | null;
      if (response.ok && data?.ok) {
        const email = success?.querySelector<HTMLElement>("[data-success-email]");
        if (email) email.textContent = value("email");
        form.classList.add("hidden");
        success?.classList.remove("hidden");
        success?.focus();
        return;
      }
      if (data?.errors) showErrors(data.errors);
      showFormError(data?.message ?? `Something went wrong. Please try again, or email us at ${fallbackEmail}.`);
      window.turnstile?.reset();
    } catch {
      showFormError(`We couldn't reach our server. Check your connection and try again, or email us at ${fallbackEmail}.`);
    } finally {
      setBusy(false);
    }
  });
}

export {};
