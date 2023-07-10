// Utility Functions
import * as _ from "lodash";
import * as moment from "moment";
import { nACHError } from "./error";
import { Field } from "./models";

// Pad a given string to a fixed width using any character or number (defaults to one blank space)
// Both a string and width are required params for this function, but it also takes two optional
// parameters. First, a boolean called 'padRight' which by default is true. This means padding
// will be applied to the right side of the string. Setting this to false will pad the left side of the
// string. You can also specify the character you want to use to pad the string.
export function pad(
  initialStr: string,
  width: number,
  padRight?: string | boolean,
  padLeft?: string | boolean,
): string {
  let shouldPadRight;
  let padChar;
  let result;
  const str = initialStr + "";

  if (typeof padRight == "boolean") {
    shouldPadRight = padRight;
    padChar = padLeft || " ";
  } else if (typeof padLeft == "boolean") {
    shouldPadRight = padLeft;
    padChar = padRight;
  } else {
    shouldPadRight = true; // padRight is true be default
    padChar = padRight || " "; // The padding character is just a space by default
  }

  if (str.length >= width) {
    return str;
  } else {
    result = new Array(width - str.length + 1).join(padChar);
    return shouldPadRight ? str + result : result + str;
  }
}

export function computeCheckDigit(routing: string): string {
  const a = routing.split("").map(Number);

  return a.length !== 8
    ? routing
    : routing +
        ((7 * (a[0] + a[3] + a[6]) +
          3 * (a[1] + a[4] + a[7]) +
          9 * (a[2] + a[5])) %
          10);
}

// This function is passed a field and a regex and tests the field's value property against the given regex
export function testRegex(regex: RegExp, field: Field): boolean {
  const string = field.number
    ? parseFloat(field.value as string)
        .toFixed(2)
        .replace(/\./, "")
    : (field.value as string);
  if (!regex.test(string)) {
    throw new nACHError({
      name: "Invalid Data Type",
      message:
        field.name +
        "'s data type is required to be " +
        field.type +
        ", but its contents don't reflect that.",
    });
  }

  return true;
}

// This function iterates through the object passed in and checks to see if it has a "position" property. If so, we pad it, and then concatenate it where belongs.
export function generateString(fields: Record<string, Field>): string {
  let counter = 1;
  let result = "";

  // How does this actually work? It doesn't seem like this is enough protection from iterating infinitely.
  const objectCount = _.size(fields);

  while (counter < objectCount) {
    _.forEach(fields, (field: Field) => {
      if (field.position === counter) {
        if (field.blank === true || field.type == "alphanumeric") {
          result = result + pad(field.value as string, field.width);
        } else {
          const string = field.number
            ? parseFloat(field.value as string)
                .toFixed(2)
                .replace(/\./, "")
            : (field.value as string);
          const paddingChar = field.paddingChar || "0";
          result = result + pad(string, field.width, false, paddingChar);
        }
        counter++;
      }
    });
  }
  return result;
}

export function parseLine(
  str: string,
  object: Record<string, Field>,
): Record<string, string> {
  const result: Record<string, string> = {};
  let pos = 0;
  Object.keys(object).forEach((key) => {
    const field = object[key];
    result[key] = str.substr(pos, field.width).trim();
    pos += field.width;
  });
  return result;
}

export function overrideLowLevel(
  values: string[],
  options: Record<string, any>,
  self: { set: (field: string, value: any) => void },
) {
  // For each override value, check to see if it exists on the options object & if so, set it
  _.forEach(values, (field) => {
    if (options[field]) {
      self.set(field, options[field]);
    }
  });
}

export function getNextMultiple(value: number, multiple: number): number {
  return value % multiple == 0
    ? value
    : value + (multiple - (value % multiple));
}

export function getNextMultipleDiff(value: number, multiple: number): number {
  return getNextMultiple(value, multiple) - value;
}

// This allows us to create a valid ACH date in the YYMMDD format
export const formatDate = function (date) {
  const year = pad(date.getFullYear().toString().slice(-2), 2, false, "0");
  const month = pad((date.getMonth() + 1).toString(), 2, false, "0");
  const day = pad(date.getDate().toString(), 2, false, "0");

  return year + month + day;
};

// Create a valid timestamp used by the ACH system in the HHMM format
export function formatTime(date: Date) {
  const hour = date.getHours().toString();
  const minute = date.getMinutes().toString();

  return pad(hour, 2, false, "0") + pad(minute, 2, false, "0");
}

export function isBusinessDay(day) {
  const d = moment(day).day();
  return !!(d !== 0 && d !== 6);
}

// This function takes an optional starting date to iterate from based
export function computeBusinessDay(businessDays, ...args): Date {
  const day = args[0] ? moment(args[0]) : moment();
  let counter = 0;

  function addDays() {
    day.add(1, "days");
    if (isBusinessDay(day)) {
      counter++;
    }
    return counter === businessDays ? day.toDate() : addDays();
  }

  return addDays();
}

export function newLineChar() {
  return "\r\n";
}
