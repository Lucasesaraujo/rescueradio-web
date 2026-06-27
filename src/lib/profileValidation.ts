const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidFullName(value: string) {
  return value.trim().length >= 6;
}

export function isValidContact(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

export function isValidOptionalEmail(value: string) {
  const email = value.trim();
  return !email || EMAIL_RE.test(email);
}

export function profileFieldErrors(form: { full_name: string; contato: string; email?: string }) {
  const errors: Record<string, string> = {};
  if (!isValidFullName(form.full_name)) {
    errors.full_name = "Informe ao menos 6 caracteres.";
  }
  if (!isValidContact(form.contato)) {
    errors.contato = "Use um telefone com DDD, com 10 ou 11 digitos.";
  }
  if (!isValidOptionalEmail(form.email || "")) {
    errors.email = "Informe um e-mail valido ou deixe em branco.";
  }
  return errors;
}
