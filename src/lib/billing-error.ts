export class BillingError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BILLING_ERROR") {
    super(message);
    this.name = "BillingError";
    this.status = status;
    this.code = code;
  }
}
