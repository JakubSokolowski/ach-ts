// TODO: Maybe validate position with indexes

import { nACHError } from "./error";
import { testRegex } from "./utils";

import * as _ from "lodash";

const ACHAddendaTypeCodes = ["02", "05", "98", "99"];
const ACHTransactionCodes = [
  "22",
  "23",
  "24",
  "27",
  "28",
  "29",
  "32",
  "33",
  "34",
  "37",
  "38",
  "39",
];
const ACHServiceClassCodes = ["200", "220", "225"];
const numericRegex = /^[0-9]+$/;
const alphaRegex = /^[a-zA-Z]+$/;
const alphanumericRegex = /^[0-9a-zA-Z!"#$%&'()*+,-./:;<>=?@[\]\\^_`{}|~ ]+$/;
let array;
let sum;

// Validate required fields to make sure they have values
export function validateRequiredFields(object) {
  _.forEach(object, function (field) {
    // This check ensures a required field's value is not NaN, null, undefined or empty. Zero is valid, but the data type check will make sure any fields with 0 are numeric.
    if (
      field.required === true &&
      (_.isNaN(field.value) ||
        _.isNull(field.value) ||
        _.isUndefined(field.value) ||
        field.value.toString().length === 0)
    ) {
      throw new nACHError({
        name: "Required Field Blank",
        message:
          field.name + " is a required field but its value is: " + field.value,
      });
    }
  });

  return true;
}

// Validate the lengths of fields by using their `width` property
export function validateLengths(object) {
  _.forEach(object, function (field) {
    if (field.value.toString().length > field.width) {
      throw new nACHError({
        name: "Invalid Length",
        message:
          field.name +
          "'s length is " +
          field.value.length +
          ", but it should be no greater than " +
          field.width +
          ".",
      });
    }
  });

  return true;
}

export function getNextMultipleDiff(value, multiple) {
  return value + (multiple - (value % multiple)) - value;
}

// Validate the data given is of the correct ACH data type
export function validateDataTypes(object) {
  _.forEach(object, function (field) {
    if (field.blank !== true) {
      switch (field.type) {
        case "numeric":
          testRegex(numericRegex, field);
          break;
        case "alpha":
          testRegex(alphaRegex, field);
          break;
        case "alphanumeric":
          testRegex(alphanumericRegex, field);
          break;
      }
    }
  });

  return true;
}

export function validateACHAddendaTypeCode(addendaTypeCode) {
  if (
    addendaTypeCode.length !== 2 ||
    !_.includes(ACHAddendaTypeCodes, addendaTypeCode)
  ) {
    throw new nACHError({
      name: "ACH Addenda Type Code Error",
      message:
        "The ACH addenda type code " +
        addendaTypeCode +
        " is invalid. Please pass a valid 2-digit addenda type code.",
    });
  }

  return true;
}

// Insure a given transaction code is valid
export function validateACHCode(transactionCode) {
  if (
    transactionCode.length !== 2 ||
    !_.includes(ACHTransactionCodes, transactionCode)
  ) {
    throw new nACHError({
      name: "ACH Transaction Code Error",
      message:
        "The ACH transaction code " +
        transactionCode +
        " is invalid. Please pass a valid 2-digit transaction code.",
    });
  }

  return true;
}

// Insure a given transaction code is valid
export function validateACHAddendaCode(transactionCode) {
  // if (transactionCode.length !== 2 || !_.includes(ACHTransactionCodes, transactionCode)) {
  //   throw new nACHError({
  //     name: 'ACH Transaction Code Error',
  //     message: 'The ACH transaction code ' + transactionCode + ' is invalid for addenda records. Please pass a valid 2-digit transaction code.'
  //   });
  // }

  return true;
}

export function validateACHServiceClassCode(serviceClassCode) {
  if (
    serviceClassCode.length !== 3 ||
    !_.includes(ACHServiceClassCodes, serviceClassCode)
  ) {
    throw new nACHError({
      name: "ACH Service Class Code Error",
      message:
        "The ACH service class code " +
        serviceClassCode +
        " is invalid. Please pass a valid 3-digit service class code.",
    });
  }

  return true;
}

export function validateRoutingNumber(routing) {
  // Make sure the routing number is exactly 9-digits long
  if (routing.toString().length !== 9) {
    throw new nACHError({
      name: "Invalid ABA Number Length",
      message:
        "The ABA routing number " +
        routing +
        " is " +
        routing.toString().length +
        "-digits long, but it should be 9-digits long.",
    });
  }

  // Split the routing number into an array of numbers. `array` will look like this: `[2,8,1,0,8,1,4,7,9]`.
  array = routing.split("").map(Number);

  // Validate the routing number (ABA). See here for more info: http://www.brainjar.com/js/validation/
  sum =
    3 * (array[0] + array[3] + array[6]) +
    7 * (array[1] + array[4] + array[7]) +
    1 * (array[2] + array[5] + array[8]);

  // Throw an error if the the result of `sum` modulo 10 is not zero. The value of `sum` must be a multiple of 10 to be a valid routing number.
  if (sum % 10 !== 0) {
    throw new nACHError({
      name: "Invalid ABA Number",
      message:
        "The ABA routing number " +
        routing +
        " is invalid. Please ensure a valid 9-digit ABA routing number is passed.",
    });
  }

  return true;
}
