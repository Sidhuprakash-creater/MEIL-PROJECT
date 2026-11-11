"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   MEIL ESG Platform — Standard & Scientific calculator

   A React port of the standalone calculator tool. The expression engine lives
   in `@/lib/calculator/engine` (a hand-written parser — no `eval`), and the
   panel chrome lives in `calculator.css`.
   ═══════════════════════════════════════════════════════════════════════════ */

import * as React from "react";
import { evaluateLoose, formatResult, type AngleMode } from "@/lib/calculator/engine";

export interface CalculatorPanelProps {
  /** Scientific mode adds the function pad (2nd, Deg, mc/mr/m+, trig, log…). */
  scientific: boolean;
}

interface HistoryEntry {
  expression: string;
  result: string;
  /** Raw numeric result, so clicking a history row restores a usable value. */
  raw: string;
}

/** Main keypad — 4 columns, with the equals key spanning the full width. */
const PAD_KEYS: Array<{ label: string; action: string; kind?: "op" | "eq" }> = [
  { label: "C", action: "C" },
  { label: "(", action: "(" },
  { label: ")", action: ")" },
  { label: "⌫", action: "back" },
  { label: "7", action: "7" },
  { label: "8", action: "8" },
  { label: "9", action: "9" },
  { label: "÷", action: "/", kind: "op" },
  { label: "4", action: "4" },
  { label: "5", action: "5" },
  { label: "6", action: "6" },
  { label: "×", action: "*", kind: "op" },
  { label: "1", action: "1" },
  { label: "2", action: "2" },
  { label: "3", action: "3" },
  { label: "−", action: "-", kind: "op" },
  { label: "%", action: "%" },
  { label: "0", action: "0" },
  { label: ".", action: "." },
  { label: "+", action: "+", kind: "op" },
  { label: "=", action: "=", kind: "eq" },
];

/**
 * Function pad. `label` is what the key shows; `action` is what it inserts.
 * When the 2nd key is active the `second` pair replaces it (sin → sin⁻¹, etc.).
 */
const FN_KEYS: Array<{
  label: string;
  action: string;
  second?: { label: string; action: string };
  toggle?: "second" | "deg";
}> = [
  { label: "2nd", action: "second", toggle: "second" },
  { label: "Deg", action: "deg", toggle: "deg" },
  { label: "mc", action: "mc" },
  { label: "mr", action: "mr" },
  { label: "m+", action: "m+" },
  { label: "π", action: "π" },
  { label: "e", action: "e" },
  { label: "sin", action: "sin(", second: { label: "sin⁻¹", action: "asin(" } },
  { label: "cos", action: "cos(", second: { label: "cos⁻¹", action: "acos(" } },
  { label: "tan", action: "tan(", second: { label: "tan⁻¹", action: "atan(" } },
  { label: "ln", action: "ln(", second: { label: "eˣ", action: "e^(" } },
  { label: "log", action: "log(", second: { label: "10ˣ", action: "10^(" } },
  { label: "√", action: "√(", second: { label: "∛", action: "cbrt(" } },
  { label: "x²", action: "^2", second: { label: "x³", action: "^3" } },
  { label: "xʸ", action: "^" },
  { label: "n!", action: "!" },
  { label: "|x|", action: "abs(" },
  { label: "1/x", action: "1/(" },
];

export function CalculatorPanel({ scientific }: CalculatorPanelProps) {
  const [expression, setExpression] = React.useState("");
  const [lastExpression, setLastExpression] = React.useState("");
  const [justEvaluated, setJustEvaluated] = React.useState(false);
  const [result, setResult] = React.useState("0");
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [angleMode, setAngleMode] = React.useState<AngleMode>("deg");
  const [second, setSecond] = React.useState(false);
  const [memory, setMemory] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const engineState = React.useMemo(() => ({ mode: angleMode, second }), [angleMode, second]);

  /** Live preview of the expression as it is typed. */
  const preview = React.useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return "";
    if (!/[\d)πe!%]$/.test(trimmed)) return "";
    try {
      const value = evaluateLoose(trimmed, engineState);
      if (!Number.isFinite(value)) return "";
      return formatResult(value);
    } catch {
      return "";
    }
  }, [expression, engineState]);

  const evaluateExpression = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      try {
        const value = evaluateLoose(trimmed, engineState);
        if (!Number.isFinite(value)) throw new Error("Not a finite result");
        return value;
      } catch {
        return null;
      }
    },
    [engineState],
  );

  /** Insert a token into the expression, replacing a dangling operator. */
  const insert = React.useCallback(
    (token: string) => {
      setExpression((prev) => {
        let next = prev;
        const isOperator = /^[+\-*/^%!]$/.test(token);
        // After "=", a non-operator starts a fresh calculation; an operator
        // continues from the result (96 → "96 +").
        if (justEvaluated) {
          if (!isOperator) next = "";
          setJustEvaluated(false);
        }        // Replace a trailing operator when another operator is typed.
        if (/[+\-*/^]$/.test(next) && /^[+*/^]/.test(token)) {
          next = next.slice(0, -1);
        }
        // Never start an expression with a binary operator.
        if (!next && isOperator && token !== "-") return next;
        // Keep adjacent letter tokens separate ("e" + "sin(" → "e sin(").
        if (/[a-z]$/i.test(next) && /^[a-z]/i.test(token)) next += " ";
        return next + token;
      });
      setError(null);
    },
    [justEvaluated],
  );

  const handleEquals = React.useCallback(() => {
    const value = evaluateExpression(expression);
    if (value === null) {
      setError("That expression could not be evaluated.");
      setResult("Error");
      setJustEvaluated(false);
      return;
    }
    const formatted = formatResult(value);
    setHistory((prev) =>
      [
        { expression: expression.replace(/\*/g, "×").replace(/\//g, "÷"), result: formatted, raw: String(value) },
        ...prev,
      ].slice(0, 40),
    );
    setLastExpression(expression);
    setExpression(String(value));
    setResult(formatted);
    setJustEvaluated(true);
    setError(null);
  }, [expression, evaluateExpression]);

  const handleAction = React.useCallback(
    (action: string) => {
      switch (action) {
        case "C":
          setExpression("");
          setLastExpression("");
          setResult("0");
          setJustEvaluated(false);
          setError(null);
          return;
        case "back": {
          // Delete a whole function name plus its opening paren, else one char.
          setExpression((prev) =>
            prev.replace(/(asin|acos|atan|sin|cos|tan|cbrt|abs|log|ln)\($/, "").replace(/.$/, ""),
          );
          setJustEvaluated(false);
          setError(null);
          return;
        }
        case "=": {
          handleEquals();
          return;
        }
        case "second":
          setSecond((v) => !v);
          return;
        case "deg":
          setAngleMode((m) => (m === "deg" ? "rad" : "deg"));
          return;
        case "mc":
          setMemory(0);
          return;
        case "mr":
          insert(memory < 0 ? `(${memory})` : String(memory));
          return;
        case "m+": {
          const value = evaluateExpression(expression);
          if (value !== null) setMemory((m) => m + value);
          return;
        }
        default:
          insert(action);
      }
    },
    [evaluateExpression, expression, handleEquals, insert, memory],
  );

  /** Keyboard support while the panel is mounted. */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Never steal keystrokes from a form field the user is typing into.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;
      let action: string | null = null;
      if (/^[0-9.+\-()^!%]$/.test(key)) action = key;
      else if (key === "*") action = "*";
      else if (key === "/") action = "/";
      else if (key === "=") action = "=";
      else if (key === "Enter" && target?.tagName !== "BUTTON") action = "=";
      else if (key === "Backspace") action = "back";
      else if (key === "Delete" || key.toLowerCase() === "c") action = "C";
      else if (key.toLowerCase() === "p") action = "π";

      if (action === null) return;
      event.preventDefault();
      if (action === "=") handleEquals();
      else handleAction(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleAction, handleEquals]);

  const displayExpression = justEvaluated ? `${lastExpression} =` : expression;
  const displayResult = justEvaluated ? result : preview ? `= ${preview}` : "0";

  return (
    <div>
      {/* ── Display ── */}
      <div className="mcalc-display">
        <div className="mcalc-display-meta">
          <span>{scientific ? (angleMode === "deg" ? "DEG" : "RAD") : ""}</span>
          <span>{memory !== 0 ? "M" : ""}</span>
        </div>
        <div className="mcalc-display-expr">{displayExpression || "0"}</div>
        <div className="mcalc-display-result">{displayResult}</div>
      </div>

      {error ? <p className="mcalc-err">{error}</p> : null}

      {/* ── Scientific function pad ── */}
      {scientific ? (
        <div className="mcalc-fn">
          {FN_KEYS.map((key) => {
            const isSecondToggle = key.toggle === "second" && second;
            const isRadToggle = key.toggle === "deg" && angleMode === "rad";
            const active = isSecondToggle || isRadToggle;
            const shown = second && key.second ? key.second : key;
            return (
              <button
                key={key.action}
                type="button"
                className={`mcalc-key fn${active ? " on" : ""}`}
                onClick={() => handleAction(shown.action)}
                aria-label={shown.label}
              >
                {shown.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Main keypad ── */}
      <div className="mcalc-pad">
        {PAD_KEYS.map((key) => (
          <button
            key={key.action}
            type="button"
            className={`mcalc-key${key.kind === "op" ? " op" : ""}${key.kind === "eq" ? " eq wide" : ""}`}
            onClick={() => handleAction(key.action)}
          >
            {key.label}
          </button>
        ))}
      </div>

      {/* ── History ── */}
      <div className="mcalc-card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 className="mcalc-card-title" style={{ margin: 0 }}>History</h3>
          {history.length > 0 ? (
            <button
              type="button"
              style={{ border: 0, background: "none", color: "var(--mcalc-ink-faint)", cursor: "pointer", fontWeight: 700, fontSize: 11.5 }}
              onClick={() => setHistory([])}
            >
              Clear
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="mcalc-note" style={{ marginTop: 6 }}>Your calculations will appear here.</p>
        ) : (
          <div style={{ marginTop: 4 }}>
            {history.map((entry, index) => (
              <button
                key={`${entry.expression}-${index}`}
                type="button"
                className="mcalc-hist-item"
                onClick={() => {
                  setExpression(entry.raw);
                  setJustEvaluated(false);
                  setError(null);
                }}
              >
                <span className="mcalc-hist-expr">{entry.expression} =</span>
                <b className="mcalc-hist-val">{entry.result}</b>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
