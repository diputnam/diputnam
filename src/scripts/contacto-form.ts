const form = document.querySelector<HTMLFormElement>('[data-contact-form]');

if (form) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const label = form.querySelector<HTMLElement>('[data-submit-label]');
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'));
  let sending = false;

  const setState = (state: 'idle' | 'loading' | 'success' | 'error', message = '') => {
    form.dataset.state = state;
    if (button) button.disabled = state === 'loading';
    if (label) label.textContent = state === 'loading' ? form.dataset.sending ?? '' : state === 'error' ? form.dataset.retry ?? '' : form.dataset.submit ?? '';
    if (status) status.textContent = message;
  };

  const validate = () => {
    for (const field of fields) {
      field.setCustomValidity('');
      if (field.required && !field.value.trim()) field.setCustomValidity(form.dataset.required ?? '');
      else if (field instanceof HTMLInputElement && field.type === 'email' && field.validity.typeMismatch) field.setCustomValidity(form.dataset.invalidEmail ?? '');
    }
    return form.reportValidity();
  };

  fields.forEach((field) => field.addEventListener('input', () => field.setCustomValidity('')));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending || !validate()) return;
    sending = true;
    setState('loading', form.dataset.sending);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (!response.ok) throw new Error('contact');
      form.reset();
      form.querySelector<HTMLSelectElement>('select')?.dispatchEvent(new Event('change', { bubbles: true }));
      setState('success', form.dataset.success);
    } catch {
      setState('error', form.dataset.error);
    } finally {
      sending = false;
    }
  });
}
