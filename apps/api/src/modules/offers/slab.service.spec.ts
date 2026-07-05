import { SlabService } from "./slab.service";

describe("SlabService.classifySlab", () => {
  const slabService = new SlabService(undefined as never);
  const definition = { superDreamMinCtc: 10, dreamMinCtc: 20 };

  it("returns null when no definition is configured", () => {
    expect(slabService.classifySlab(15, null)).toBeNull();
  });

  it("classifies below superDreamMinCtc as NON_DREAM", () => {
    expect(slabService.classifySlab(9.99, definition)).toBe("NON_DREAM");
  });

  it("classifies exactly at superDreamMinCtc as SUPER_DREAM (inclusive boundary)", () => {
    expect(slabService.classifySlab(10, definition)).toBe("SUPER_DREAM");
  });

  it("classifies between the two thresholds as SUPER_DREAM", () => {
    expect(slabService.classifySlab(15, definition)).toBe("SUPER_DREAM");
  });

  it("classifies exactly at dreamMinCtc as DREAM (inclusive boundary)", () => {
    expect(slabService.classifySlab(20, definition)).toBe("DREAM");
  });

  it("classifies above dreamMinCtc as DREAM", () => {
    expect(slabService.classifySlab(50, definition)).toBe("DREAM");
  });
});
