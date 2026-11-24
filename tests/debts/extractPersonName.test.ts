import { describe, expect, it } from "vitest";
import { extractPersonName } from "../../src/debts/extractPersonName";

describe("extractPersonName", () => {
  it("extracts a Cyrillic name + initial", () => {
    expect(extractPersonName("Роман П.")).toBe("Роман П.");
    expect(extractPersonName("Айгерім Т.")).toBe("Айгерім Т.");
  });

  it("handles Kazakh letters, including the Latin-Schwa rendering Kaspi uses", () => {
    expect(extractPersonName("Əбілмансұр Д.")).toBe("Əбілмансұр Д.");
    expect(extractPersonName("Əли Ə.")).toBe("Əли Ə.");
  });

  it("matches an ALL-CAPS surname", () => {
    expect(extractPersonName("УРУНБАЕВ Б.")).toBe("УРУНБАЕВ Б.");
  });

  it("strips a trailing ', <bank name>' suffix", () => {
    expect(extractPersonName("Азалия С., Bank CenterCredit")).toBe("Азалия С.");
    expect(extractPersonName("УРУНБАЕВ Б., Eurasian Bank")).toBe("УРУНБАЕВ Б.");
  });

  it("rejects a bare first name with no initial", () => {
    expect(extractPersonName("Айша")).toBeNull();
    expect(extractPersonName("Нур")).toBeNull();
  });

  it("rejects merchant-looking descriptions", () => {
    expect(extractPersonName("Магазин IZABELLA")).toBeNull();
    expect(extractPersonName("202 MyMart Ак Булак 2")).toBeNull();
    expect(extractPersonName('ИП "ГАФИТУЛИН И.Ш"')).toBeNull();
    expect(extractPersonName("K17")).toBeNull();
    expect(extractPersonName("OZON.KZ")).toBeNull();
    expect(extractPersonName("Tele2")).toBeNull();
  });
});
