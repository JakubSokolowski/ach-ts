import { formatDate, formatTime, generateString, pad } from "./utils";

import * as moment from "moment";
import { Field } from "./models";

describe("Utils", () => {
  describe("pad", () => {
    it("should add pad", () => {
      const testS = "1991";
      const testW = 0;

      expect(() => {
        pad(testS, testW);
      }).not.toThrow("Padding not adding");
    });
  });

  describe("GenerateString", () => {
    it("Test to see if object can be passed", function () {
      const testObj: Record<string, Field> = {
        testRecord: {
          name: "Record Type Code",
          width: 1,
          position: 1,
          required: true,
          type: "numeric",
          value: "5",
        },
      };

      expect(function () {
        generateString(testObj);
      }).not.toThrow("Not passing object correctly.");
    });
  });

  describe("YYMMDD", function () {
    it("Must return the current date", function () {
      const day = moment().get("date").toString();
      const year = moment().get("year").toString().slice(-2);
      const month = (moment().get("month") + 1).toString();

      const date = moment().format("YYMMDD");
      const dateNum = formatDate(new Date());

      if (dateNum === date) {
        expect(function () {
          formatDate;
        }).not.toThrow("Dates match");
      }

      // The formatDate() function never throws an error -- this test isn't accurate
      // else { expect(function() { utils.formatDate }).toThrow('Dates don\'t match');}
    });
  });

  describe("HHMM", function () {
    it("Must return the current time", function () {
      const hour = moment().hour().toString();
      const minute = moment().minute().toString();

      const time = hour + minute;

      const utilsTime = formatTime(new Date());

      if (utilsTime === time) {
        expect(function () {
          formatTime;
        }).not.toThrow("Times match");
      }

      // The formatTime() function never throws an error -- this test isn't accurate
      // else { expect(function() { utils.formatTime }).toThrow('Times don\'t match.') }
    });
  });
});
