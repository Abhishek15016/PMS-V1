import { TenantContextStore } from "./tenant-context.store";

describe("TenantContextStore", () => {
  it("throws when read outside of a run() scope", () => {
    const store = new TenantContextStore();
    expect(() => store.getTenantIdOrThrow()).toThrow(/outside of a request/);
  });

  it("returns the tenantId set for the current scope", () => {
    const store = new TenantContextStore();
    store.run({ tenantId: "tenant-a" }, () => {
      expect(store.getTenantIdOrThrow()).toBe("tenant-a");
    });
  });

  it("isolates concurrent async scopes from each other (the actual risk with middleware-based context)", async () => {
    const store = new TenantContextStore();
    const observedForA: string[] = [];
    const observedForB: string[] = [];

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const runA = store.run({ tenantId: "tenant-a" }, async () => {
      observedForA.push(store.getTenantIdOrThrow());
      await delay(20);
      observedForA.push(store.getTenantIdOrThrow());
      await delay(5);
      observedForA.push(store.getTenantIdOrThrow());
    });

    const runB = store.run({ tenantId: "tenant-b" }, async () => {
      await delay(5);
      observedForB.push(store.getTenantIdOrThrow());
      await delay(5);
      observedForB.push(store.getTenantIdOrThrow());
    });

    await Promise.all([runA, runB]);

    expect(observedForA).toEqual(["tenant-a", "tenant-a", "tenant-a"]);
    expect(observedForB).toEqual(["tenant-b", "tenant-b"]);
  });
});
