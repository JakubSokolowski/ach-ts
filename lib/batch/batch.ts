import {
  computeCheckDigit,
  formatDate,
  generateStringSync,
  newLineChar,
  overrideLowLevel,
} from "../utils";
import {
  validateACHServiceClassCode,
  validateDataTypes,
  validateLengths,
  validateRequiredFields,
  validateRoutingNumber,
} from "../validate";
import { batchHeader } from "./header";
import { batchControl } from "./control";

import * as moment from "moment";

import * as _ from "lodash";
import { Entry } from "../entry";
import { Field } from "../models";

const highLevelHeaderOverrides = [
  "serviceClassCode",
  "companyDiscretionaryData",
  "companyIdentification",
  "standardEntryClassCode",
];

const highLevelControlOverrides = [
  "addendaCount",
  "entryHash",
  "totalDebit",
  "totalCredit",
];

export type BatchOptions = {
  header?: Record<string, Field>;
  control?: Record<string, Field>;
  originatingDFI?: string;
  companyName?: string;
  companyEntryDescription?: string;
  companyDescriptiveDate?: string;
  serviceClassCode?: string;
  companyDiscretionaryData?: string;
  companyIdentification?: string;
  standardEntryClassCode?: string;
  effectiveEntryDate?: Date | string;
};

export class Batch {
  private readonly entries: Entry[];

  public header: Record<string, Field>;
  public control: Record<string, Field>;

  constructor(options: BatchOptions, autoValidate = true) {
    this.entries = [];

    this.header = options.header
      ? _.merge(options.header, batchHeader, _.defaults)
      : _.cloneDeep(batchHeader);
    this.control = options.control
      ? _.merge(options.header, batchControl, _.defaults)
      : _.cloneDeep(batchControl);

    overrideLowLevel(highLevelHeaderOverrides, options as any, this);
    overrideLowLevel(highLevelControlOverrides, options as any, this);

    if (autoValidate !== false) {
      validateRoutingNumber(computeCheckDigit(options.originatingDFI));
    }

    if (options.companyName) {
      this.header.companyName.value = options.companyName.slice(
        0,
        this.header.companyName.width,
      );
    }

    if (options.companyEntryDescription) {
      this.header.companyEntryDescription.value =
        options.companyEntryDescription.slice(
          0,
          this.header.companyEntryDescription.width,
        );
    }

    if (options.companyDescriptiveDate) {
      this.header.companyDescriptiveDate.value =
        options.companyDescriptiveDate.slice(
          0,
          this.header.companyDescriptiveDate.width,
        );
    }

    if (options.effectiveEntryDate) {
      if (typeof options.effectiveEntryDate === "string") {
        options.effectiveEntryDate = moment(
          options.effectiveEntryDate,
          "YYMMDD",
        ).toDate();
      }
      this.header.effectiveEntryDate.value = formatDate(
        options.effectiveEntryDate,
      );
    }

    if (options.originatingDFI) {
      this.header.originatingDFI.value = computeCheckDigit(
        options.originatingDFI,
      ).slice(0, this.header.originatingDFI.width);
    }

    this.control.serviceClassCode.value = this.header.serviceClassCode.value;
    this.control.companyIdentification.value =
      this.header.companyIdentification.value;
    this.control.originatingDFI.value = this.header.originatingDFI.value;

    if (autoValidate !== false) {
      this._validate();
    }
  }

  private _validate() {
    validateRequiredFields(this.header);
    validateACHServiceClassCode(this.header.serviceClassCode.value);
    validateLengths(this.header);
    validateDataTypes(this.header);
    validateRequiredFields(this.control);
    validateLengths(this.control);
    validateDataTypes(this.control);
  }

  public addEntry(entry: Entry) {
    (this.control.addendaCount.value as string) += entry.getRecordCount();
    this.entries.push(entry);

    let entryHash = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const creditCodes = ["22", "23", "24", "32", "33", "34"];
    const debitCodes = ["27", "28", "29", "37", "38", "39"];

    this.entries.forEach((entry) => {
      entryHash += Number(entry.fields.receivingDFI.value);

      if (_.includes(creditCodes, entry.fields.transactionCode.value)) {
        totalCredit += entry.fields.amount.value;
      } else if (_.includes(debitCodes, entry.fields.transactionCode.value)) {
        totalDebit += entry.fields.amount.value;
      } else {
        console.log(
          "Transaction codes did not match or are not supported yet (unsupported status codes include: 23, 24, 28, 29, 33, 34, 38, 39)",
        );
      }
    });

    this.control.totalCredit.value = totalCredit;
    this.control.totalDebit.value = totalDebit;
    this.control.entryHash.value = entryHash.toString().slice(-10);
  }

  public getEntries() {
    return this.entries;
  }

  public generateHeader(): string {
    return generateStringSync(this.header);
  }

  public generateControl(): string {
    return generateStringSync(this.control);
  }

  public generateEntries(): string {
    let result = "";

    this.entries.forEach((entry) => {
      const entryString = entry.generateString();
      result += entryString + newLineChar();
    });

    return result;
  }

  public generateString(): string {
    const headerString = this.generateHeader();
    const entryString = this.generateEntries();
    const controlString = this.generateControl();
    return headerString + newLineChar() + entryString + controlString;
  }

  get(field) {
    // If the header has the field, return the value
    if (this.header[field]) {
      return this.header[field].value;
    }

    // If the control has the field, return the value
    if (this.control[field]) {
      return this.control[field].value;
    }
  }

  set(field, value) {
    // If the header has the field, set the value
    if (this.header[field]) {
      this.header[field].value = value;
    }

    // If the control has the field, set the value
    if (this.control[field]) {
      this.control[field].value = value;
    }
  }
}
