export class SupplierError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "SUPPLIER_ERROR") {
    super(message);
    this.name = "SupplierError";
    this.status = status;
    this.code = code;
  }
}
