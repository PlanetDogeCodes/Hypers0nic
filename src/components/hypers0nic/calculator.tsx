"use client";

import { useState, useCallback } from "react";
import { Delete, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Calculator({ onClose }: { onClose?: () => void }) {
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === "0" ? digit : display + digit);
      }
    },
    [display, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay("0");
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const performCalculation = useCallback(
    (nextOperator: string) => {
      const inputValue = parseFloat(display);

      if (previous === null) {
        setPrevious(inputValue);
      } else if (operator) {
        const currentValue = previous;
        const result = calculate(currentValue, inputValue, operator);
        setDisplay(String(result));
        setPrevious(result);
      }

      setWaitingForOperand(true);
      setOperator(nextOperator);
    },
    [display, previous, operator]
  );

  const equals = useCallback(() => {
    if (previous !== null && operator) {
      const inputValue = parseFloat(display);
      const result = calculate(previous, inputValue, operator);
      setDisplay(String(result));
      setPrevious(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }, [display, previous, operator]);

  const toggleSign = useCallback(() => {
    setDisplay((d) => (d.startsWith("-") ? d.slice(1) : d === "0" ? d : "-" + d));
  }, []);

  const percent = useCallback(() => {
    setDisplay((d) => String(parseFloat(d) / 100));
  }, []);

  const btnBase =
    "flex items-center justify-center rounded-xl text-lg font-semibold transition-all active:scale-90 select-none";
  const btnNum = cn(btnBase, "bg-muted/40 text-foreground hover:bg-muted/60");
  const btnOp = cn(btnBase, "bg-primary/20 text-primary hover:bg-primary/30");
  const btnFn = cn(btnBase, "bg-muted/20 text-muted-foreground hover:bg-muted/40");
  const btnEq = cn(btnBase, "bg-primary text-primary-foreground hover:bg-primary/90");

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Calculator</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-label="Close calculator"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Display */}
      <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 text-right">
        <div className="overflow-x-auto">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {display}
          </span>
        </div>
        {operator && previous !== null && (
          <div className="text-xs text-muted-foreground">
            {previous} {operator}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className={cn(btnFn, "col-span-2 h-12")}>
          AC
        </button>
        <button onClick={toggleSign} className={cn(btnFn, "h-12")}>
          ±
        </button>
        <button onClick={percent} className={cn(btnFn, "h-12")}>
          %
        </button>

        <button onClick={() => inputDigit("7")} className={cn(btnNum, "h-12")}>
          7
        </button>
        <button onClick={() => inputDigit("8")} className={cn(btnNum, "h-12")}>
          8
        </button>
        <button onClick={() => inputDigit("9")} className={cn(btnNum, "h-12")}>
          9
        </button>
        <button onClick={() => performCalculation("÷")} className={cn(btnOp, "h-12")}>
          ÷
        </button>

        <button onClick={() => inputDigit("4")} className={cn(btnNum, "h-12")}>
          4
        </button>
        <button onClick={() => inputDigit("5")} className={cn(btnNum, "h-12")}>
          5
        </button>
        <button onClick={() => inputDigit("6")} className={cn(btnNum, "h-12")}>
          6
        </button>
        <button onClick={() => performCalculation("×")} className={cn(btnOp, "h-12")}>
          ×
        </button>

        <button onClick={() => inputDigit("1")} className={cn(btnNum, "h-12")}>
          1
        </button>
        <button onClick={() => inputDigit("2")} className={cn(btnNum, "h-12")}>
          2
        </button>
        <button onClick={() => inputDigit("3")} className={cn(btnNum, "h-12")}>
          3
        </button>
        <button onClick={() => performCalculation("-")} className={cn(btnOp, "h-12")}>
          −
        </button>

        <button onClick={() => inputDigit("0")} className={cn(btnNum, "h-12 col-span-2")}>
          0
        </button>
        <button onClick={inputDecimal} className={cn(btnNum, "h-12")}>
          .
        </button>
        <button onClick={() => performCalculation("+")} className={cn(btnOp, "h-12")}>
          +
        </button>

        <button onClick={equals} className={cn(btnEq, "h-12 col-span-4")}>
          =
        </button>
      </div>
    </div>
  );
}

function calculate(a: number, b: number, op: string): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}
