import { describe, it, expect } from "vitest";
import { parseCsv, suggestColumnMapping } from "../csv";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles CRLF and trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('name,note\n"Sharma, Ravi","said ""hello"""')).toEqual([
      ["name", "note"],
      ["Sharma, Ravi", 'said "hello"'],
    ]);
  });

  it("handles newlines inside quotes", () => {
    expect(parseCsv('a,b\n"line1\nline2",x')).toEqual([
      ["a", "b"],
      ["line1\nline2", "x"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("suggestColumnMapping", () => {
  it("detects common Indian CRM headers", () => {
    const m = suggestColumnMapping(["Lead Name", "Mobile Number", "Email ID", "City"]);
    expect(m.name).toBe(0);
    expect(m.phone).toBe(1);
    expect(m.email).toBe(2);
  });

  it("returns null for missing columns", () => {
    const m = suggestColumnMapping(["foo", "bar"]);
    expect(m.phone).toBeNull();
    expect(m.email).toBeNull();
  });
});
