import * as _ from "lodash";
import { entryFields } from "./fields";
import {
  computeCheckDigit,
  generateStringSync,
  overrideLowLevel,
} from "../utils";
import {
  validateACHAddendaCode,
  validateACHCode,
  validateDataTypes,
  validateLengths,
  validateRequiredFields,
  validateRoutingNumber,
} from "../validate";
import { EntryAddenda } from "../entry-addenda";

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

export class Entry {
  addenda: EntryAddenda[] = [];
  fields: any;

  constructor(options: any, autoValidate?: boolean) {
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
      this._validate();
    }
  }

  addAddenda(entryAddenda: any) {
    // Add indicator to Entry record
    this.set("addendaId", "1");

    // Set corresponding feilds on Addenda
    entryAddenda.set("addendaSequenceNumber", this.addenda.length + 1);
    entryAddenda.set("entryDetailSequenceNumber", this.get("traceNumber"));

    // Add the new entryAddenda to the addendas array
    this.addenda.push(entryAddenda);
  }

  getAddendas() {
    return this.addenda;
  }

  getRecordCount() {
    return 1 + this.addenda.length;
  }

  generateString(): string {
    const addends = this.addenda.map((entryAddenda) => {
      return entryAddenda.generateString();
    });

    const fieldsString = generateStringSync(this.fields);

    return [fieldsString].concat(addends).join("\n");
  }

  _validate() {
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
      this.fields.receivingDFI.value + this.fields.checkDigit.value,
    );

    // Validate header field lengths
    validateLengths(this.fields);

    // Validate header data types
    validateDataTypes(this.fields);
  }

  get(category) {
    // If the header has it, return that (header takes priority)
    if (this.fields[category]) {
      return this.fields[category].value;
    }
  }

  set(category, value) {
    // If the header has the field, set the value
    if (this.fields[category]) {
      this.fields[category].value = value;
    }
  }
}
