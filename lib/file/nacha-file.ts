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
import { batchHeader } from "../batch";
import { batchControl } from "../batch";
import { entryFields } from "../entry";
import { EntryAddenda } from "../entry-addenda";
import { entryAddendaFields } from "../entry-addenda";

import { Entry } from "../entry";
import { Batch } from "../batch";

import * as async from "async";
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

export class NachaFile {
  _batches: any[];
  header: any;
  control: any;

  _batchSequenceNumber: number;

  constructor(options, autoValidate = false) {
    this._batches = [];

    // Allow the batch header/control defaults to be overriden if provided
    this.header = options.header
      ? _.merge(options.header, generateFileHeader(), _.defaults)
      : generateFileHeader();
    this.control = options.control
      ? _.merge(options.header, fileControl, _.defaults)
      : _.cloneDeep(fileControl);

    // Configure high-level overrides (these override the low-level settings if provided)
    overrideLowLevel(highLevelOverrides, options, this);

    // This is done to make sure we have a 9-digit routing number
    if (options.immediateDestination) {
      this.header.immediateDestination.value = computeCheckDigit(
        options.immediateDestination,
      );
    }

    this._batchSequenceNumber = Number(options.batchSequenceNumber) || 0;

    if (autoValidate !== false) {
      // Validate all values
      this._validate();
    }
  }

  _validate() {
    // Validate header field lengths
    validateLengths(this.header);

    // Validate header data types
    validateDataTypes(this.header);

    // Validate control field lengths
    validateLengths(this.control);

    // Validate header data types
    validateDataTypes(this.control);
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
      return;
    }

    // If the control has the field, set the value
    if (this.control[field]) {
      this.control[field].value = value;
      return;
    }
  }

  addBatch(batch) {
    // Set the batch number on the header and control records
    batch.header.batchNumber.value = this._batchSequenceNumber;
    batch.control.batchNumber.value = this._batchSequenceNumber;

    // Increment the batchSequenceNumber
    ++this._batchSequenceNumber;

    this._batches.push(batch);
  }

  getBatches() {
    return this._batches;
  }

  generatePaddedRows(rows, cb) {
    let paddedRows = "";

    for (let i = 0; i < rows; i++) {
      paddedRows += newLineChar() + pad("", 94, "9");
    }

    // Return control flow back by calling the callback function
    cb(paddedRows);
  }

  generateBatches(done1) {
    let result = "";
    let rows = 2;

    let entryHash = 0;
    let addendaCount = 0;

    let totalDebit = 0;
    let totalCredit = 0;

    async.each(
      this._batches,
      (batch, done2) => {
        totalDebit += batch.control.totalDebit.value;
        totalCredit += batch.control.totalCredit.value;

        async.each(
          batch._entries,
          (entry, done3) => {
            entry.fields.traceNumber.value = entry.fields.traceNumber.value
              ? entry.fields.traceNumber.value
              : this.header.immediateOrigin.value.slice(0, 8) +
                pad(addendaCount, 7, false, "0");
            entryHash += Number(entry.fields.receivingDFI.value);

            // Increment the addenda and block count
            addendaCount++;
            rows++;

            done3();
          },
          (err) => {
            // Only iterate and generate the batch if there is at least one entry in the batch
            if (batch._entries.length > 0) {
              // Increment the addendaCount of the batch
              this.control.batchCount.value++;

              // Bump the number of rows only for batches with at least one entry
              rows = rows + 2;

              // Generate the batch after we've added the trace numbers
              batch.generateString(function (batchString) {
                result += batchString + newLineChar();
                done2();
              });
            } else {
              done2();
            }
          },
        );
      },
      (err) => {
        this.control.totalDebit.value = totalDebit;
        this.control.totalCredit.value = totalCredit;

        this.control.addendaCount.value = addendaCount;
        this.control.blockCount.value = getNextMultiple(rows, 10) / 10;

        // Slice the 10 rightmost digits.
        this.control.entryHash.value = entryHash.toString().slice(-10);

        // Pass the result string as well as the number of rows back
        done1(result, rows);
      },
    );
  }

  generateHeader(cb) {
    generateString(this.header, function (string) {
      cb(string);
    });
  }
  generateControl(cb) {
    generateString(this.control, function (string) {
      cb(string);
    });
  }

  generateFile(cb) {
    return new Promise((resolve) => {
      this.generateHeader((headerString) => {
        this.generateBatches((batchString, rows) => {
          this.generateControl((controlString) => {
            // These must be within this callback otherwise rows won't be calculated yet
            const paddedRows = getNextMultipleDiff(rows, 10);

            this.generatePaddedRows(paddedRows, (paddedString) => {
              const str =
                headerString +
                newLineChar() +
                batchString +
                controlString +
                paddedString;
              cb && cb(undefined, str);
              resolve(str);
            });
          });
        });
      });
    });
  }

  writeFile(path, cb) {
    return new Promise((resolve, reject) => {
      this.generateFile((err, str) => {
        if (err) {
          cb && cb(err);
          reject(err);
        } else {
          fs.writeFile(path, str, (err) => {
            if (err) {
              cb && cb(err);
              reject(err);
            } else {
              cb && cb(undefined, str);
              resolve(str);
            }
          });
        }
      });
    });
  }

  static parseFile(filePath, cb?: (err: any, file?: any) => void) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
          return cb && cb(err);
        }
        resolve(NachaFile.parse(data.toString(), cb));
      });
    });
  }

  static parse(str, cb?: (err: any, file?: any) => void) {
    return new Promise(function (resolve, reject) {
      if (!str || !str.length) {
        reject("Input string is empty");
        return cb && cb("Input string is empty");
      }
      let lines = str.split("\n");
      if (lines.length <= 1) {
        lines = [];
        for (let i = 0; i < str.length; i += 94) {
          lines.push(str.substr(i, 94));
        }
      }
      const file: Record<string, any> = {};
      const batches = [];
      let batchIndex = 0;
      let hasAddenda = false;
      lines.forEach(function (line) {
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
        return cb && cb("File records parse error");
      }
      if (!batches || batches.length === 0) {
        reject("No batches found");
        return cb && cb("No batches found");
      }
      try {
        let nachFile;
        if (!hasAddenda) {
          nachFile = new NachaFile(file.header);
        } else {
          nachFile = new NachaFile(file.header, false);
        }

        batches.forEach(function (batchOb) {
          const batch = new Batch(batchOb.header);
          batchOb.entry.forEach(function (entry) {
            batch.addEntry(entry);
          });
          nachFile.addBatch(batch);
        });
        cb && cb(undefined, nachFile);
        resolve(nachFile);
      } catch (e) {
        reject(e);
        return cb && cb(e);
      }
    });
  }
}
