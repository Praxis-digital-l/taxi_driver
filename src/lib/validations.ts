export function sanitizeInput(value: string): string {
  return value
    .trim()
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "El correo electrónico es obligatorio";
  if (trimmed.length > 254) return "El correo electrónico es demasiado largo";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) return "Formato de correo electrónico inválido";
  return null;
}

export function validatePhone(phone: string): string | null {
  const cleaned = phone.trim();
  if (!cleaned) return "El teléfono es obligatorio";
  if (cleaned.length > 20) return "El teléfono es demasiado largo";
  const re = /^(\+56\s?)?(9\s?\d{4}\s?\d{4}|2\d{7,8})$/;
  const normalized = cleaned.replace(/\s+/g, " ");
  if (!re.test(normalized)) return "Formato de teléfono chileno inválido (ej: +56 9 XXXX XXXX)";
  return null;
}

export function validateRut(rut: string): string | null {
  const cleaned = rut.trim().replace(/\./g, "").replace(/\s+/g, "");
  if (!cleaned) return "El RUT es obligatorio";
  if (cleaned.length > 12) return "El RUT es demasiado largo";

  const match = cleaned.match(/^(\d{1,8})-([\dkK])$/);
  if (!match) return "Formato de RUT inválido (ej: 12.345.678-5)";

  const body = match[1];
  const dv = match[2].toLowerCase();

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedDv = 11 - (sum % 11);
  const computedDv =
    expectedDv === 11 ? "0" : expectedDv === 10 ? "k" : String(expectedDv);

  if (dv !== computedDv) return "RUT inválido: dígito verificador incorrecto";
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} es obligatorio`;
  return null;
}

export function validateMaxLength(value: string, max: number, fieldName: string): string | null {
  if (value.trim().length > max) return `${fieldName} no debe exceder ${max} caracteres`;
  return null;
}

export function validateMinLength(value: string, min: number, fieldName: string): string | null {
  if (value.trim().length < min) return `${fieldName} debe tener al menos ${min} caracteres`;
  return null;
}

export type ValidationErrors = Record<string, string | null>;

export function validateConductorForm(form: FormData): ValidationErrors {
  const nombres = sanitizeInput((form.get("nombres") as string) || "");
  const apellidoPaterno = sanitizeInput((form.get("apellido_paterno") as string) || "");
  const apellidoMaterno = sanitizeInput((form.get("apellido_materno") as string) || "");
  const email = (form.get("email") as string) || "";
  const phone = (form.get("phone") as string) || "";
  const rut = (form.get("rut") as string) || "";
  const password = (form.get("password") as string) || "";

  const errors: ValidationErrors = {
    nombres: validateRequired(nombres, "Nombre"),
    apellido_paterno: validateRequired(apellidoPaterno, "Apellido paterno"),
    email: validateEmail(email),
    phone: validatePhone(phone),
    rut: validateRut(rut),
    password: null,
    apellido_materno: null,
  };

  if (password) {
    errors.password = validateMinLength(password, 6, "Contraseña");
  }

  return errors;
}
