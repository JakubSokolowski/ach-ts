// Entry

import { generateStringSync, overrideLowLevel } from "../utils";
import {
  validateACHAddendaTypeCode,
  validateDataTypes,
  validateLengths,
  validateRequiredFields,
} from "../validate";
import { entryAddendaFields } from "./fields";

import * as _ from "lodash";

const highLevelOverrides = [
  "addendaTypeCode",
  "paymentRelatedInformation",
  "addendaSequenceNumber",
  "entryDetailSequenceNumber",
];

export class EntryAddenda {
  fields: any;

  constructor(options: any, autoValidate = true) {
    // Allow the file header defaults to be overriden if provided
    this.fields = options.fields
      ? _.merge(options.fields, entryAddendaFields, _.defaults)
      : _.cloneDeep(entryAddendaFields);

    // Set our high-level values
    overrideLowLevel(highLevelOverrides, options, this);

    // Some values need special coercing, so after they've been set by overrideLowLevel() we override them
    if (options.returnCode) {
      this.fields.returnCode.value = options.returnCode.slice(
        0,
        this.fields.returnCode.width,
      );
    }

    if (options.paymentRelatedInformation) {
      this.fields.paymentRelatedInformation.value =
        options.paymentRelatedInformation.slice(
          0,
          this.fields.paymentRelatedInformation.width,
        );
    }

    if (options.addendaSequenceNumber) {
      this.fields.addendaSequenceNumber.value = Number(
        options.addendaSequenceNumber,
      );
    }

    if (options.entryDetailSequenceNumber) {
      this.fields.entryDetailSequenceNumber.value =
        options.entryDetailSequenceNumber.slice(
          0 - this.fields.entryDetailSequenceNumber.width,
        ); // last n digits. pass
    }

    if (autoValidate !== false) {
      // Validate required fields have been passed
      this._validate();
    }
  }

  generateString(): string {
    return generateStringSync(this.fields);
  }

  _validate() {
    // Validate required fields
    validateRequiredFields(this.fields);

    // Validate the ACH code passed is actually valid
    validateACHAddendaTypeCode(this.fields.addendaTypeCode.value);

    // Validate header field lengths
    validateLengths(this.fields);

    // Validate header data types
    validateDataTypes(this.fields);
  }

  get(category: string) {
    // If the header has it, return that (header takes priority)
    if (this.fields[category]) {
      return this.fields[category].value;
    }
  }

  set(category: string, value: any) {
    // If the header has the field, set the value
    if (this.fields[category]) {
      if (category == "entryDetailSequenceNumber") {
        this.fields[category].value = value.slice(
          0 - this.fields[category].width,
        ); // pass last n digits
      } else {
        this.fields[category].value = value;
      }
    }
  }

  getReturnCode() {
    if (
      this.fields.paymentRelatedInformation.value ||
      this.fields.paymentRelatedInformation.value.length > 0
    ) {
      return this.fields.paymentRelatedInformation.value.slice(0, 3);
    }
    return false;
  }
}
