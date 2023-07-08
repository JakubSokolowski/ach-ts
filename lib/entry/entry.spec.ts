import { Entry } from "./entry";
import { EntryAddenda } from "../entry-addenda";

describe("Entry", function () {
  describe("Create Entry", function () {
    it("should create an entry successfully", function () {
      const entry = new Entry({
        receivingDFI: "081000210",
        DFIAccount: "12345678901234567",
        amount: "3521",
        transactionCode: "22",
        idNumber: "RAj##23920rjf31",
        individualName: "Glen Selle",
        discretionaryData: "A1",
      });
      entry.generateString((string) => {
        const expected =
          "622081000210123456789012345670000352100RAj##23920rjf31Glen Selle            A10               ";
        expect(string).toEqual(expected);
        console.log(string);
      });
    });
  });
  describe("Create Entry with addenda", function () {
    it("should create an entry with an addenda successfully", function () {
      const entry = new Entry({
        receivingDFI: "081000210",
        DFIAccount: "12345678901234567",
        amount: "3521",
        transactionCode: "22",
        idNumber: "RAj##23920rjf31",
        individualName: "Glen Selle",
        discretionaryData: "A1",
        traceNumber: "000000001234567",
      });
      const addenda = new EntryAddenda({
        paymentRelatedInformation:
          "3456789ABCDEFGJIJKLMNOPQRSTUVWXYXabcdefgjijklmnopqrstuvwxyx",
      });
      expect(entry.getRecordCount()).toEqual(1);
      entry.addAddenda(addenda);
      expect(entry.get("addendaId")).toEqual("1");
      expect(entry.getRecordCount()).toEqual(2);
      expect(addenda.get("addendaSequenceNumber")).toEqual(1);
      expect(addenda.get("entryDetailSequenceNumber")).toEqual("1234567");
      const addenda2 = new EntryAddenda({
        paymentRelatedInformation:
          "0123456789ABCDEFGJIJKLMNOPQRSTUVWXYXabcdefgjijklmnopqrstuvwxyx",
      });
      entry.addAddenda(addenda2);
      expect(entry.get("addendaId")).toEqual("1");
      expect(entry.getRecordCount()).toEqual(3);
      // expect(addenda.get('addendaSequenceNumber')).to.equal(2);
      expect(addenda.get("entryDetailSequenceNumber")).toEqual("1234567");
      entry.generateString(function (string) {
        console.log(string);
        const expectedStr =
          "622081000210123456789012345670000352100RAj##23920rjf31Glen Selle            A11000000001234567\n" +
          "7053456789ABCDEFGJIJKLMNOPQRSTUVWXYXabcdefgjijklmnopqrstuvwxyx                     01001234567\n" +
          "7050123456789ABCDEFGJIJKLMNOPQRSTUVWXYXabcdefgjijklmnopqrstuvwxyx                  02001234567";

        expect(string).toEqual(expectedStr);
      });
    });
  });
});
