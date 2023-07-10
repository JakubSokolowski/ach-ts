import * as _ from "lodash";
import { entryFields } from "./fields";
import { computeCheckDigit, generateString, overrideLowLevel } from "../utils";
import {
  validateACHAddendaCode,
  validateACHCode,
  validateDataTypes,
  validateLengths,
  validateRequiredFields,
  validateRoutingNumber,
} from "../validate";
import { EntryAddenda } from "../entry-addenda";
import { Field } from "../models";

export const highLevelOverrides = [
  "transactionCode",
  "receivingDFI",
  "checkDigit",
  "DFIAccount",
  "amount",
  "idNumber",
  "individualName",
  "discretionaryData",
  "addendaId",
  "traceNumber",
];

export type EntryOptions = {
  fields?: Record<string, Field>;
  receivingDFI?: string;
  DFIAccount?: string;
  amount?: string;
  idNumber?: string;
  individualName?: string;
  discretionaryData?: string;
  addendaId?: string;
  traceNumber?: string;
  transactionCode?: string;
};

export class Entry {
  addenda: EntryAddenda[] = [];
  fields: Record<string, Field>;

  constructor(options: EntryOptions, autoValidate?: boolean) {
    this.fields = options.fields
      ? _.merge(options.fields, entryFields, _.defaults)
      : _.cloneDeep(entryFields);

    // Set our high-level values
    overrideLowLevel(highLevelOverrides, options, this);

    // Some values need special coercing, so after they've been set by overrideLowLevel() we override them
    if (options.receivingDFI) {
      this.fields.receivingDFI.value = computeCheckDigit(
        options.receivingDFI,
      ).slice(0, -1);
      this.fields.checkDigit.value = computeCheckDigit(
        options.receivingDFI,
      ).slice(-1);
    }

    if (options.DFIAccount) {
      this.fields.DFIAccount.value = options.DFIAccount.slice(
        0,
        this.fields.DFIAccount.width,
      );
    }

    if (options.amount) {
      this.fields.amount.value = Number(options.amount);
    }

    if (options.idNumber) {
      this.fields.idNumber.value = options.idNumber;
    }

    if (options.individualName) {
      this.fields.individualName.value = options.individualName.slice(
        0,
        this.fields.individualName.width,
      );
    }

    if (options.discretionaryData) {
      this.fields.discretionaryData.value = options.discretionaryData;
    }

    if (autoValidate !== false) {
      // Validate required fields have been passed
      this.validate();
    }
  }

  addAddenda(entryAddenda: EntryAddenda): void {
    // Add indicator to Entry record
    this.set("addendaId", "1");

    // Set corresponding fields on Addenda
    entryAddenda.set("addendaSequenceNumber", this.addenda.length + 1);
    entryAddenda.set("entryDetailSequenceNumber", this.get("traceNumber"));

    // Add the new entryAddenda to the addendas array
    this.addenda.push(entryAddenda);
  }

  getAddendas(): EntryAddenda[] {
    return this.addenda;
  }

  getRecordCount(): number {
    return 1 + this.addenda.length;
  }

  generateString(): string {
    const addends = this.addenda.map((entryAddenda) => {
      return entryAddenda.generateString();
    });

    const fieldsString = generateString(this.fields);

    return [fieldsString].concat(addends).join("\n");
  }

  private validate(): void {
    // Validate required fields
    validateRequiredFields(this.fields);

    // Validate the ACH code passed is actually valid
    if (this.fields.addendaId.value == "0") {
      validateACHCode(this.fields.transactionCode.value);
    } else {
      validateACHAddendaCode(this.fields.transactionCode.value);
    }

    // Validate the routing number
    validateRoutingNumber(
      (this.fields.receivingDFI.value as number) +
        (this.fields.checkDigit.value as number),
    );

    // Validate header field lengths
    validateLengths(this.fields);

    // Validate header data types
    validateDataTypes(this.fields);
  }

  get(category): number | string {
    // If the header has it, return that (header takes priority)
    if (this.fields[category]) {
      return this.fields[category].value;
    }
  }

  set(category: string, value: any): void {
    // If the header has the field, set the value
    if (this.fields[category]) {
      this.fields[category].value = value;
    }
  }
}
