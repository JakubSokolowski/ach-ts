// Entry

import { generateString, overrideLowLevel } from "../utils";
import {
  validateACHAddendaTypeCode,
  validateDataTypes,
  validateLengths,
  validateRequiredFields,
} from "../validate";
import { entryAddendaFields } from "./fields";

import * as _ from "lodash";
import { Field } from "../models";

const highLevelOverrides = [
  "addendaTypeCode",
  "paymentRelatedInformation",
  "addendaSequenceNumber",
  "entryDetailSequenceNumber",
];

export type EntryAddendaOptions = {
  fields?: Record<string, Field>;
  returnCode?: string;
  paymentRelatedInformation?: string;
  addendaSequenceNumber?: string;
  entryDetailSequenceNumber?: string;
};

export class EntryAddenda {
  fields: Record<string, Field>;

  constructor(options: EntryAddendaOptions, autoValidate = true) {
    // Allow the file header defaults to be overriden if provided
    const { fields, ...rest } = options;
    this.fields = fields
      ? _.merge(fields, entryAddendaFields, _.defaults)
      : _.cloneDeep(entryAddendaFields);

    // Set our high-level values
    overrideLowLevel(highLevelOverrides, rest, this);

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
      this.validate();
    }
  }

  generateString(): string {
    return generateString(this.fields);
  }

  private validate() {
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

  set(category: string, value: any): void {
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
      (this.fields.paymentRelatedInformation.value as string).length > 0
    ) {
      return (this.fields.paymentRelatedInformation.value as string).slice(
        0,
        3,
      );
    }
    return false;
  }
}
