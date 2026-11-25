export class CustomerError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "CUSTOMER_ERROR") {
    super(message);
    this.name = "CustomerError";
    this.status = status;
    this.code = code;
  }
}
