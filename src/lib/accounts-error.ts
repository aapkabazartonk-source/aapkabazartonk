export class AccountsError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "ACCOUNTS_ERROR") {
    super(message);
    this.name = "AccountsError";
    this.status = status;
    this.code = code;
  }
}
