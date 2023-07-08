"use strict";
// Create a new object, that prototypally inherits from the Error constructor.

export class nACHError extends Error {
  constructor(errorObj: Error) {
    super();
    this.name = "nACHError[" + errorObj.name + "]" || "nACHError";
    this.message = errorObj.message || "Uncaught nACHError";
  }
}
