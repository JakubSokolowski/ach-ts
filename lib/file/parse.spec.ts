import { NachaFile } from "./nacha-file";

describe("Parse", function () {
  describe("Validate", function () {
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
});
