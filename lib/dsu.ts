// lib/dsu.ts
export class DSU {
  private parent: Map<string, string> = new Map();
  private size: Map<string, number> = new Map();

  makeSet(x: string) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.size.set(x, 1);
    }
  }

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) throw new Error(`Unknown node: ${x}`);
    if (p !== x) {
      const r = this.find(p);
      this.parent.set(x, r); // path compression
      return r;
    }
    return x;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const sa = this.size.get(ra)!;
    const sb = this.size.get(rb)!;
    // union by size
    if (sa < sb) {
      this.parent.set(ra, rb);
      this.size.set(rb, sa + sb);
    } else {
      this.parent.set(rb, ra);
      this.size.set(ra, sa + sb);
    }
  }

  groups(): Record<string, string[]> {
    const buckets: Record<string, string[]> = {};
    for (const x of this.parent.keys()) {
      const r = this.find(x);
      (buckets[r] ||= []).push(x);
    }
    return buckets;
  }

  groupSize(x: string): number {
    return this.size.get(this.find(x)) ?? 0;
  }
}
