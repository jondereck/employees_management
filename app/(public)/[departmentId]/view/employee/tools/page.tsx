// app/(dashboard)/[departmentId]/(routes)/tools/infix-to-postfix/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCcw, Wand2, Dice3 } from "lucide-react";
import { infixToPostfix } from "@/lib/algos/infix-to-postfix";
import { generateRandomInfix } from "@/lib/algos/random-infix";
import PublicFooter from "@/components/public/footer";
import AppFooter from "./components/footer";

export default function InfixToPostfixPage() {
  const [expr, setExpr] = useState<string>("((x1 + x2) * (y1 - y2)) / 2");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  const demoList = useMemo(
    () => [
      "((x1 + x2) * (y1 - y2)) / 2",
      "(A + B) * C - D ^ E ^ F",
      "3 + 4 * 2 / (1 - 5) ^ 2 ^ 3",
      "-A + (B * -3)",
      "salary * (rate + bonus) / 12",
    ],
    []
  );

  const convert = () => {
    try {
      setError(null);
      const out = infixToPostfix(expr);
      setResult(out);
    } catch (e: any) {
      setResult("");
      setError(e?.message ?? "Unexpected error.");
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {}
  };

  const clearAll = () => {
    setExpr("");
    setResult("");
    setError(null);
  };

  const randomize = () => {
    // You can tweak options here if you want to bias the style:
    const rnd = generateRandomInfix({
      maxDepth: 3,
      allowPow: true,
      allowUnaryMinus: true,
      numberChance: 0.4,
    });
    setExpr(rnd);
    setResult("");
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Machine Problem: Infix → Postfix Converter</h1>
        <p className="text-sm text-muted-foreground mt-1">
         Supports + − × ÷ ^, parentheses, multi-digit numbers, identifiers, and unary minus.
        </p>
      </header>

      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Enter Infix Expression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="e.g., ((x1 + x2) * (y1 - y2)) / 2"
            rows={3}
            className="font-mono"
          />

          <div className="flex gap-2 flex-wrap">
            <Button onClick={convert} className="gap-2">
              <Wand2 className="h-4 w-4" /> Convert
            </Button>
            <Button variant="secondary" onClick={randomize} className="gap-2">
              <Dice3 className="h-4 w-4" /> Random
            </Button>
            <Button variant="secondary" onClick={clearAll} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Clear
            </Button>
            <Button variant="outline" onClick={copy} disabled={!result} className="gap-2 ml-auto">
              <Copy className="h-4 w-4" /> Copy Result
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Postfix Output</label>
            <Input readOnly value={result} className="font-mono" placeholder="Result appears here…" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <p className="text-sm text-muted-foreground mb-2">Quick Examples</p>
        <div className="flex flex-wrap gap-2">
          {demoList.map((d) => (
            <button
              key={d}
              onClick={() => setExpr(d)}
              className="text-xs rounded-full border px-3 py-1 hover:bg-accent hover:text-accent-foreground transition"
              title="Use this example"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

   
    </div>
  );
}
