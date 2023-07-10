import * as _ from "lodash";
import { generateFileHeader } from "./header";
import { fileControl } from "./control";
import {
  computeCheckDigit,
  generateString,
  getNextMultiple,
  getNextMultipleDiff,
  newLineChar,
  overrideLowLevel,
  pad,
  parseLine,
} from "../utils";
import { validateDataTypes, validateLengths } from "../validate";
import * as fs from "fs";
import { Batch, batchControl, batchHeader } from "../batch";
import { Entry, entryFields } from "../entry";
import { EntryAddenda, entryAddendaFields } from "../entry-addenda";
import { Field } from "../models";

export const highLevelOverrides = [
  "immediateDestination",
  "immediateOrigin",
  "fileCreationDate",
  "fileCreationTime",
  "fileIdModifier",
  "immediateDestinationName",
  "immediateOriginName",
  "referenceCode",
];

export type NachaFileOptions = {
  header?: Record<string, Field>;
  control?: Record<string, Field>;
  immediateDestination?: string;
  immediateOrigin?: string;
  immediateDestinationName?: string;
  immediateOriginName?: string;
  referenceCode?: string;

  batchSequenceNumber?: number;
};

export class NachaFile {
  batches: Batch[];
  header: Record<string, Field>;
  control: Record<string, Field>;

  _batchSequenceNumber: number;

  constructor(options: NachaFileOptions, autoValidate = false) {
    this.batches = [];

    // Allow the batch header/control defaults to be overriden if provided
    this.header = options.header
      ? _.merge(options.header, generateFileHeader(), _.defaults)
      : generateFileHeader();
    this.control = options.control
      ? _.merge(options.header, fileControl, _.defaults)
      : _.cloneDeep(fileControl);

    // Configure high-level overrides (these override the low-level settings if provided)
    overrideLowLevel(highLevelOverrides, options as any, this);

    // This is done to make sure we have a 9-digit routing number
    if (options.immediateDestination) {
      this.header.immediateDestination.value = computeCheckDigit(
        options.immediateDestination,
      );
    }

    this._batchSequenceNumber = Number(options.batchSequenceNumber) || 0;

    if (autoValidate !== false) {
      // Validate all values
      this.validate();
    }
  }

  validate(): void {
    // Validate header field lengths
    validateLengths(this.header);

    // Validate header data types
    validateDataTypes(this.header);

    // Validate control field lengths
    validateLengths(this.control);

    // Validate header data types
    validateDataTypes(this.control);
  }

  get(field: string): string | number {
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
      return;
    }

    // If the control has the field, set the value
    if (this.control[field]) {
      this.control[field].value = value;
      return;
    }
  }

  addBatch(batch: Batch): void {
    // Set the batch number on the header and control records
    batch.header.batchNumber.value = this._batchSequenceNumber;
    batch.control.batchNumber.value = this._batchSequenceNumber;

    // Increment the batchSequenceNumber
    ++this._batchSequenceNumber;

    this.batches.push(batch);
  }

  getBatches(): Batch[] {
    return this.batches;
  }

  generatePaddedRows(rows: number): string {
    let paddedRows = "";

    for (let i = 0; i < rows; i++) {
      paddedRows += newLineChar() + pad("", 94, "9");
    }

    // Return control flow back by calling the callback function
    return paddedRows;
  }

  generateBatches(): [string, number] {
    let result = "";
    let rows = 2;

    let entryHash = 0;
    let addendaCount = 0;

    let totalDebit = 0;
    let totalCredit = 0;

    this.batches.forEach((batch: Batch) => {
      totalDebit += batch.control.totalDebit.value as number;
      totalCredit += batch.control.totalCredit.value as number;

      batch.getEntries().forEach((entry: Entry) => {
        entry.fields.traceNumber.value = entry.fields.traceNumber.value
          ? entry.fields.traceNumber.value
          : (this.header.immediateOrigin.value as string).slice(0, 8) +
            pad(addendaCount.toString(), 7, false, "0");
        entryHash += Number(entry.fields.receivingDFI.value);

        // Increment the addenda and block count
        addendaCount++;
        rows++;
      });

      if (batch.getEntries().length > 0) {
        // Increment the addendaCount of the batch
        (this.control.batchCount.value as number)++;

        // Bump the number of rows only for batches with at least one entry
        rows = rows + 2;

        // Generate the batch after we've added the trace numbers
        const batchString = batch.generateString();
        result += batchString + newLineChar();
      }
    });

    this.control.totalDebit.value = totalDebit;
    this.control.totalCredit.value = totalCredit;

    this.control.addendaCount.value = addendaCount;
    this.control.blockCount.value = getNextMultiple(rows, 10) / 10;

    // Slice the 10 rightmost digits.
    this.control.entryHash.value = entryHash.toString().slice(-10);

    // Return control flow back by calling the callback function
    return [result, rows];
  }

  generateHeader(): string {
    return generateString(this.header);
  }

  generateControl() {
    return generateString(this.control);
  }

  generateFile(): Promise<string> {
    return new Promise((resolve) => {
      const headerString = this.generateHeader();
      const [batchString, rows] = this.generateBatches();

      const controlString = this.generateControl();
      const numPaddedRows = getNextMultipleDiff(rows, 10);

      const paddedString = this.generatePaddedRows(numPaddedRows);
      const str =
        headerString +
        newLineChar() +
        batchString +
        controlString +
        paddedString;
      resolve(str);
    });
  }

  writeFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.generateFile().then((str) => {
        fs.writeFile(path, str, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  static parseFile(filePath): Promise<NachaFile> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(NachaFile.parse(data.toString()));
      });
    });
  }

  static parse(inputStr: string): Promise<NachaFile> {
    return new Promise((resolve, reject) => {
      if (!inputStr || !inputStr.length) {
        reject("Input string is empty");
        return;
      }
      let lines = inputStr.split("\n");
      if (lines.length <= 1) {
        lines = [];
        for (let i = 0; i < inputStr.length; i += 94) {
          lines.push(inputStr.substr(i, 94));
        }
      }
      const file: {
        header: Record<string, string>;
        control: Record<string, string>;
      } = {
        header: {},
        control: {},
      };
      const batches = [];
      let batchIndex = 0;
      let hasAddenda = false;
      lines.forEach((line) => {
        if (!line || !line.length) {
          return;
        }
        switch (parseInt(line[0])) {
          case 1:
            file.header = parseLine(line, generateFileHeader());
            break;
          case 9:
            file.control = parseLine(line, fileControl);
            break;
          case 5:
            batches.push({
              header: parseLine(line, batchHeader),
              entry: [],
              addenda: [],
            });
            break;
          case 8:
            batches[batchIndex].control = parseLine(line, batchControl);
            batchIndex++;
            break;
          case 6:
            batches[batchIndex].entry.push(
              new Entry(parseLine(line, entryFields)),
            );
            break;
          case 7:
            batches[batchIndex].entry[
              batches[batchIndex].entry.length - 1
            ].addAddenda(
              new EntryAddenda(parseLine(line, entryAddendaFields), false),
            );
            hasAddenda = true;
            break;
        }
      });
      if (!file.header || !file.control) {
        reject("File records parse error");
      }
      if (!batches || batches.length === 0) {
        reject("No batches found");
        return;
      }
      try {
        let nachaFile;
        if (!hasAddenda) {
          nachaFile = new NachaFile(file.header);
        } else {
          nachaFile = new NachaFile(file.header, false);
        }

        batches.forEach((batchOb) => {
          const batch = new Batch(batchOb.header);
          batchOb.entry.forEach((entry) => {
            batch.addEntry(entry);
          });
          nachaFile.addBatch(batch);
        });
        resolve(nachaFile);
      } catch (e) {
        reject(e);
      }
    });
  }
}
