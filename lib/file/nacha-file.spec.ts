import { NachaFile } from "./nacha-file";
import { EntryAddenda } from "../entry-addenda";
import { Entry } from "../entry";
import { Batch } from "../batch";
import * as fs from "fs";
import * as moment from "moment";
import { Field } from "../models";

import * as Headers from "../file/header";

const exampleHeader: Record<string, Field> = {
  recordTypeCode: {
    name: "Record Type Code",
    width: 1,
    position: 1,
    required: true,
    type: "numeric",
    value: "1",
  },
  priorityCode: {
    name: "Priority Code",
    width: 2,
    position: 2,
    required: true,
    type: "numeric",
    value: "01",
  },
  immediateDestination: {
    name: "Immediate Destination",
    width: 10,
    position: 3,
    required: true,
    type: "ABA",
    paddingChar: " ",
    value: "",
  },
  immediateOrigin: {
    name: "Immediate Origin",
    width: 10,
    position: 4,
    required: true,
    type: "numeric",
    paddingChar: " ",
    value: "",
  },
  fileCreationDate: {
    name: "File Creation Date",
    width: 6,
    position: 5,
    required: true,
    type: "numeric",
    value: "230708",
  },
  fileCreationTime: {
    name: "File Creation Time",
    width: 4,
    position: 6,
    required: true,
    type: "numeric",
    value: "2210",
  },
  fileIdModifier: {
    name: "File Modifier",
    width: 1,
    position: 7,
    required: true,
    type: "alphanumeric",
    value: "A",
  },
  recordSize: {
    name: "Record Size",
    width: 3,
    position: 8,
    type: "numeric",
    required: true,
    value: "094",
  },
  blockingFactor: {
    name: "Blocking Factor",
    width: 2,
    position: 9,
    type: "numeric",
    required: true,
    value: "10",
  },
  formatCode: {
    name: "Format Code",
    width: 1,
    position: 10,
    required: true,
    type: "numeric",
    value: "1",
  },
  immediateDestinationName: {
    name: "Immediate Destination Name",
    width: 23,
    position: 11,
    required: true,
    type: "alphanumeric",
    value: "",
  },
  immediateOriginName: {
    name: "Immediate Origin Name",
    width: 23,
    position: 12,
    required: true,
    type: "alphanumeric",
    value: "",
  },
  referenceCode: {
    name: "Reference Code",
    width: 8,
    position: 13,
    required: true,
    type: "alphanumeric",
    value: "",
  },
};

describe("NachaFile", function () {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Parse", function () {
    it("should parse successfully", function (done) {
      NachaFile.parseFile(
        __dirname + "/mocks/nach-valid.txt",
        function (err, file) {
          if (err) throw err;
          expect(file).toBeDefined();
          done();
        },
      );
    });

    it("should parse Addenda successfully", function (done) {
      NachaFile.parseFile(
        __dirname + "/mocks/nach-valid-addenda.txt",
        function (err, file: any) {
          if (err) throw err;
          expect(file).toBeDefined();
          file.getBatches().forEach((batch) => {
            batch.getEntries().forEach((entry) => {
              entry.getAddendas().forEach((addenda) => {
                expect(addenda.getReturnCode()).toEqual("R14");
              });
            });
          });
          expect(file).toBeDefined();
          done();
        },
      );
    });

    it("should parse Addenda successfully with promise", function (done) {
      NachaFile.parseFile(__dirname + "/mocks/nach-valid-addenda.txt")
        .then((file) => {
          expect(file).toBeDefined();
          done();
        })
        .catch((err) => {
          throw err;
        });
    });
  });

  describe("Generate", function () {
    it("should generate file successfully", function (done) {
      NachaFile.parseFile(__dirname + "/mocks/nach-valid.txt")
        .then((file: NachaFile) => {
          expect(file).toBeDefined();
          file.generateFile((err, str) => {
            expect(err).toBeUndefined();
            expect(str).toBeDefined();
            done();
          });
        })
        .catch((err) => {
          throw err;
        });
    });

    it("should generate proper header", () => {
      // give
      jest.spyOn(Headers, "generateFileHeader").mockReturnValue(exampleHeader);

      const file = new NachaFile({
        immediateDestination: "081000032",
        immediateOrigin: "123456789",
        immediateDestinationName: "Some Bank",
        immediateOriginName: "Your Company Inc",
        referenceCode: "#A000001",
      });

      // when
      const header = file.generateHeader();

      // then
      const expectedHeader =
        "101 081000032 1234567892307082210A094101Some Bank              Your Company Inc       #A000001";
      expect(header).toEqual(expectedHeader);
    });

    it("should generate file with proper content", (done) => {
      // given
      jest.spyOn(Headers, "generateFileHeader").mockReturnValue(exampleHeader);

      const file = new NachaFile({
        immediateDestination: "081000032",
        immediateOrigin: "123456789",
        immediateDestinationName: "Some Bank",
        immediateOriginName: "Your Company Inc",
        referenceCode: "#A000001",
      });

      const date = moment("2023-07-08").format("MMM D");

      const batch = new Batch({
        serviceClassCode: "220",
        companyName: "Your Company Inc",
        standardEntryClassCode: "WEB",
        companyIdentification: "123456789",
        companyEntryDescription: "Trans Description",
        companyDescriptiveDate: date,
        effectiveEntryDate: date,
        originatingDFI: "081000032",
      });

      const entry = new Entry({
        receivingDFI: "081000210",
        DFIAccount: "5654221",
        amount: "175",
        idNumber: "RAj##32b1kn1bb3",
        individualName: "Luke Skywalker",
        discretionaryData: "A1",
        transactionCode: "22",
      });

      const addenda = new EntryAddenda({
        paymentRelatedInformation:
          "0123456789ABCDEFGJIJKLMNOPQRSTUVWXYXabcdefgjijklmnopqrstuvwxyx",
      });

      entry.addAddenda(addenda);
      batch.addEntry(entry);
      file.addBatch(batch);

      // when
      const expected = fs
        .readFileSync(__dirname + "/mocks/canonical.ach")
        .toString()
        .split("\n");

      file.generateFile((err, generated) => {
        const generatedLines = generated.split("\n");
        expect(generatedLines.length).toEqual(expected.length);
        for (let i = 0; i < generatedLines.length; i++) {
          // There seems to be an issue when some line has some different
          // line ending or something. Workaround for now is to split lines,
          // trim them and compare them individually.
          expect(generatedLines[i].trim()).toEqual(expected[i].trim());
        }
        done();
      });
    });
  });
});
