import { describe, expect, it } from "vitest";
import { ExprError, evalCondition, evalExpr } from "../index";

describe("safe expression evaluator (K-00)", () => {
  it("does arithmetic with correct precedence", () => {
    expect(evalExpr("2 + 3 * 4")).toBe(14);
    expect(evalExpr("(2 + 3) * 4")).toBe(20);
    expect(evalExpr("10 / 4")).toBe(2.5);
    expect(evalExpr("10 % 3")).toBe(1);
    expect(evalExpr("-5 + 2")).toBe(-3);
    expect(evalExpr("2 * -3")).toBe(-6);
  });

  it("supports ceil / floor / round / min / max / abs", () => {
    expect(evalExpr("ceil(2.1)")).toBe(3);
    expect(evalExpr("floor(2.9)")).toBe(2);
    expect(evalExpr("round(2.5)")).toBe(3);
    expect(evalExpr("min(3, 1, 2)")).toBe(1);
    expect(evalExpr("max(1, 5)")).toBe(5);
    expect(evalExpr("abs(-4)")).toBe(4);
    expect(evalExpr("ceil(beds / bedsPerRoom)", { beds: 121, bedsPerRoom: 6 })).toBe(21);
  });

  it("returns 1/0 for comparisons", () => {
    expect(evalExpr("3 > 2")).toBe(1);
    expect(evalExpr("3 <= 2")).toBe(0);
    expect(evalExpr("2 == 2")).toBe(1);
    expect(evalExpr("1 != 1")).toBe(0);
  });

  it("reads named parameters", () => {
    expect(evalExpr("beds * areaPerBed", { beds: 120, areaPerBed: 3 })).toBe(360);
  });

  it("treats a missing condition as true", () => {
    expect(evalCondition(undefined, {})).toBe(true);
    expect(evalCondition("", {})).toBe(true);
    expect(evalCondition("floors > 1", { floors: 2 })).toBe(true);
    expect(evalCondition("floors > 1", { floors: 1 })).toBe(false);
  });

  it("throws clear errors, never crashes silently", () => {
    expect(() => evalExpr("beds + 1", {})).toThrowError(ExprError);
    expect(() => evalExpr("beds + 1", {})).toThrow(/Unknown identifier "beds"/);
    expect(() => evalExpr("nope(1)")).toThrow(/Unknown function/);
    expect(() => evalExpr("1 / 0")).toThrow(/Division by zero/);
    expect(() => evalExpr("(1 + 2")).toThrow(/Missing/);
    expect(() => evalExpr("")).toThrow(/Empty/);
    expect(() => evalExpr("1 $ 2")).toThrow(/Unexpected character/);
  });
});
