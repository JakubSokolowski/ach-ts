export type FieldType = "numeric" | "alpha" | "alphanumeric" | "ABA";
export type Field = {
  name: string;
  width: number;
  position: number;
  required?: boolean;
  type: FieldType;
  value?: number | string;
  number?: boolean;
  blank?: boolean;
  paddingChar?: string;
};
