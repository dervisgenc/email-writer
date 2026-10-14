/**
 * Saat ve kimlik üretimi dışarıdan verilir; testler gerçek saate veya rastgele
 * kimliklere bağlı kalmaz.
 */
export interface Clock {
  /** ISO 8601 biçiminde şimdiki zaman. */
  now(): string;
}

export interface IdGenerator {
  next(): string;
}
