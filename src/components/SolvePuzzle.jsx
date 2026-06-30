import { useState } from "react";

/* SolvePuzzle — renders one "Solve This" puzzle inside the /creatives/:id guide
   page (CreativeGuidePage branches here when an item carries a `puzzle`). Most
   puzzles are now a "try it → check" loop sharing the GridControls bar
   (Check / Reveal / Clear + a right/wrong status line):
     INTERACTIVE (check): word_ladder (type the blanks), cipher (type the decoded
           phrase), odd_one_out (click the misfit), nonogram, sudoku4, latin4.
     REVEAL-ONLY (TextPuzzle): rebus + mystery — their answers are free-form
           phrases, so they keep the hint + Reveal Answer disclosure only.
   Self-contained: all the puzzle UI/state lives here so the guide page stays a
   simple branch. Data shape is produced by scripts/gen-solve-puzzles.js. */

// ── shared bits ────────────────────────────────────────────────────────────

// Hint disclosure + Reveal button + revealed answer block, used by the
// reveal-only puzzles (rebus, mystery). `children` is the (always-visible)
// puzzle body; `answer` is rendered only after Reveal.
function TextPuzzle({ prompt, hint, children, answer }) {
  const [showHint, setShowHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="arcade-solve">
      {prompt && <p className="arcade-solve-prompt">{prompt}</p>}
      <div className="arcade-solve-body">{children}</div>

      <div className="arcade-solve-controls">
        {hint && (
          <button
            type="button"
            className="arcade-solve-btn arcade-solve-hint-btn"
            onClick={() => setShowHint((v) => !v)}
          >
            {showHint ? "hide hint" : "💡 hint"}
          </button>
        )}
        <button
          type="button"
          className="arcade-solve-btn arcade-solve-reveal-btn"
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "hide answer" : "reveal answer"}
        </button>
      </div>

      {showHint && hint && <p className="arcade-solve-hint">{hint}</p>}

      {revealed && (
        <div className="arcade-solve-answer">
          <span className="arcade-solve-answer-label">answer</span>
          {answer}
        </div>
      )}
    </div>
  );
}

// A standalone hint disclosure (the "💡 hint" toggle + revealed text), for the
// interactive puzzles that drive their own check/reveal via GridControls and so
// don't use TextPuzzle's built-in hint. No-op when there's no hint.
function HintToggle({ hint }) {
  const [show, setShow] = useState(false);
  if (!hint) return null;
  return (
    <>
      <button
        type="button"
        className="arcade-solve-btn arcade-solve-hint-btn"
        onClick={() => setShow((v) => !v)}
      >
        {show ? "hide hint" : "💡 hint"}
      </button>
      {show && <p className="arcade-solve-hint">{hint}</p>}
    </>
  );
}

// Normalize a free-typed answer for comparison: uppercase, letters/digits only
// (so spacing and punctuation never matter — "DO A BARREL ROLL" === "doabarrelroll").
const normalizeAnswer = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ── text family ──────────────────────────────────────────────────────────--

// Word ladder: type the missing rungs, then check. A blank is right when it
// matches the canonical answer at that position (case-insensitive); first/last
// rungs are given. Reveal fills every rung; clear empties the typed blanks.
function WordLadder({ puzzle }) {
  const blanks = puzzle.rungs
    .map((w, i) => (w === "____" ? i : -1))
    .filter((i) => i >= 0);
  const blankInit = () => Object.fromEntries(blanks.map((i) => [i, ""]));
  const [vals, setVals] = useState(blankInit);
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const setRung = (i, raw) => {
    if (revealed) return;
    setStatus(null);
    // letters only, capped at the rung's length, uppercased
    const v = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, puzzle.answer[i].length);
    setVals((prev) => ({ ...prev, [i]: v }));
  };

  const check = () => {
    const ok = blanks.every((i) => vals[i] === puzzle.answer[i].toUpperCase());
    setStatus(ok ? "right" : "wrong");
  };
  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setVals(Object.fromEntries(blanks.map((i) => [i, puzzle.answer[i].toUpperCase()])));
  };
  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setVals(blankInit());
  };

  const wordLen = puzzle.answer[0]?.length || 4;

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      <ol className="arcade-solve-ladder">
        {puzzle.rungs.map((w, i) =>
          w === "____" ? (
            <li key={i} className="is-blank">
              <input
                className="arcade-solve-input arcade-solve-ladder-input"
                type="text"
                value={vals[i] ?? ""}
                maxLength={puzzle.answer[i].length}
                readOnly={revealed}
                onChange={(e) => setRung(i, e.target.value)}
                style={{ width: `${wordLen + 1}ch` }}
                aria-label={`rung ${i + 1}`}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </li>
          ) : (
            <li key={i}>{w}</li>
          )
        )}
      </ol>

      <HintToggle hint={puzzle.hint} />
      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
      />
    </div>
  );
}

// Cipher: type the decoded phrase, then check. Spacing/punctuation are ignored
// in the comparison. Reveal shows the plaintext; clear empties the input.
function Cipher({ puzzle }) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const check = () =>
    setStatus(normalizeAnswer(guess) === normalizeAnswer(puzzle.answer) ? "right" : "wrong");
  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setGuess(puzzle.answer);
  };
  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setGuess("");
  };

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}
      <p className="arcade-solve-mono arcade-solve-cipher">{puzzle.ciphertext}</p>

      <input
        className="arcade-solve-input arcade-solve-cipher-input"
        type="text"
        value={guess}
        readOnly={revealed}
        onChange={(e) => {
          setStatus(null);
          setGuess(e.target.value);
        }}
        placeholder="type the decoded message…"
        aria-label="your decoded message"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
      />

      <HintToggle hint={puzzle.hint} />
      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
      />
    </div>
  );
}

function Rebus({ puzzle }) {
  return (
    <TextPuzzle
      prompt={puzzle.prompt}
      hint={puzzle.hint}
      answer={<p className="arcade-solve-plain">{puzzle.answer}</p>}
    >
      <pre className="arcade-solve-rebus">{puzzle.display.join("\n")}</pre>
    </TextPuzzle>
  );
}

// Odd one out: click the item you think breaks the pattern, then check — no
// typing. Reveal highlights the real answer and explains why; clear deselects.
function OddOneOut({ puzzle }) {
  const [chosen, setChosen] = useState(null);
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const choose = (it) => {
    if (revealed) return;
    setStatus(null);
    setChosen(it);
  };
  const check = () => {
    if (chosen == null) return;
    setStatus(chosen === puzzle.answer ? "right" : "wrong");
  };
  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setChosen(puzzle.answer);
  };
  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setChosen(null);
  };

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      <ul className="arcade-solve-options">
        {puzzle.items.map((it, i) => {
          const selected = chosen === it;
          const isAnswer = revealed && it === puzzle.answer;
          return (
            <li key={i}>
              <button
                type="button"
                className={`arcade-solve-option${selected ? " is-selected" : ""}${
                  isAnswer ? " is-answer" : ""
                }`}
                onClick={() => choose(it)}
                aria-pressed={selected}
              >
                {it}
              </button>
            </li>
          );
        })}
      </ul>

      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
      />
      {revealed && puzzle.why && <p className="arcade-solve-why">{puzzle.why}</p>}
    </div>
  );
}

function Mystery({ puzzle }) {
  return (
    <TextPuzzle
      prompt={puzzle.prompt}
      hint={puzzle.hint}
      answer={<p className="arcade-solve-plain">{puzzle.answer}</p>}
    >
      <p className="arcade-solve-story">{puzzle.story}</p>
      {puzzle.question && <p className="arcade-solve-question">{puzzle.question}</p>}
    </TextPuzzle>
  );
}

// ── grid family ────────────────────────────────────────────────────────────

// A nonogram cell cycles: 0 empty → 1 filled → 2 marked-X → 0. Only "filled"
// counts when checking against the solution.
const NONO_EMPTY = 0;
const NONO_FILLED = 1;
const NONO_X = 2;

function Nonogram({ puzzle }) {
  const { size, rows, cols, solution, reveal } = puzzle;
  const blank = () => Array.from({ length: size }, () => Array(size).fill(NONO_EMPTY));
  const [cells, setCells] = useState(blank);
  const [status, setStatus] = useState(null); // "right" | "wrong" | null
  const [revealed, setRevealed] = useState(false);

  const cycle = (r, c) => {
    if (revealed) return;
    setStatus(null);
    setCells((prev) => {
      const next = prev.map((row) => row.slice());
      next[r][c] = (next[r][c] + 1) % 3;
      return next;
    });
  };

  const check = () => {
    // Right when every filled cell matches the solution and nothing's missing.
    const ok = solution.every((row, r) =>
      row.every((v, c) => (v === 1) === (cells[r][c] === NONO_FILLED))
    );
    setStatus(ok ? "right" : "wrong");
  };

  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setCells(solution.map((row) => row.map((v) => (v ? NONO_FILLED : NONO_EMPTY))));
  };

  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setCells(blank());
  };

  // The grid is (1 + size) columns: a row-clue gutter column, then the cells.
  // The first row is the corner spacer + column-clue gutters.
  const gridStyle = { gridTemplateColumns: `auto repeat(${size}, 1fr)` };

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      <div className="arcade-nono" style={gridStyle} role="grid" aria-label="nonogram">
        {/* top-left corner spacer */}
        <div className="arcade-nono-corner" aria-hidden="true" />
        {/* column clues */}
        {cols.map((clue, c) => (
          <div className="arcade-nono-clue arcade-nono-clue-col" key={`c${c}`}>
            {clue.map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        ))}
        {/* rows: row clue + cells */}
        {cells.map((row, r) => (
          <RowFragment key={`r${r}`}>
            <div className="arcade-nono-clue arcade-nono-clue-row">
              {rows[r].map((n, i) => (
                <span key={i}>{n}</span>
              ))}
            </div>
            {row.map((v, c) => (
              <button
                key={c}
                type="button"
                className={`arcade-nono-cell${v === NONO_FILLED ? " is-filled" : ""}${
                  v === NONO_X ? " is-x" : ""
                }`}
                onClick={() => cycle(r, c)}
                aria-label={`cell ${r + 1},${c + 1}`}
              >
                {v === NONO_X ? "✕" : ""}
              </button>
            ))}
          </RowFragment>
        ))}
      </div>

      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
        revealNote={revealed ? `It's ${reveal}!` : null}
      />
    </div>
  );
}

// CSS grid needs row cells to be siblings of their clue; a fragment keeps them
// flat in the grid container while grouping by row in JSX.
function RowFragment({ children }) {
  return <>{children}</>;
}

// Shared 4×4 number grid for sudoku4 + latin4. `given` cells are locked; the
// player TAPS a blank cell to cycle its value empty→1→2→…→size→empty (the same
// click-to-cycle idiom as the nonogram — touch-friendly, no keyboard).
function NumberGrid({ puzzle }) {
  const { size, given, solution } = puzzle;
  const init = () => given.map((row) => row.slice());
  const [cells, setCells] = useState(init);
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const locked = (r, c) => given[r][c] !== 0;

  // Tap cycles: 0 (empty) → 1 → 2 → … → size → 0. (v % size) + 1 walks 1..size,
  // and tapping at `size` lands back on 0.
  const cycle = (r, c) => {
    if (locked(r, c) || revealed) return;
    setStatus(null);
    setCells((prev) => {
      const next = prev.map((row) => row.slice());
      next[r][c] = next[r][c] >= size ? 0 : next[r][c] + 1;
      return next;
    });
  };

  const check = () => {
    const full = cells.every((row) => row.every((v) => v !== 0));
    const ok = full && solution.every((row, r) => row.every((v, c) => v === cells[r][c]));
    setStatus(ok ? "right" : "wrong");
  };

  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setCells(solution.map((row) => row.slice()));
  };

  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setCells(init());
  };

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      <div
        className={`arcade-numgrid${size === 4 ? " is-4" : ""}${
          puzzle.kind === "sudoku4" ? " has-boxes" : ""
        }`}
      >
        {cells.map((row, r) =>
          row.map((v, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              className={`arcade-numgrid-cell${locked(r, c) ? " is-locked" : ""}`}
              onClick={() => cycle(r, c)}
              // Locked givens are truly disabled; after Reveal the cells stay
              // visually filled (the cycle() guard already blocks edits), so we
              // don't gray the solved grid out.
              disabled={locked(r, c)}
              aria-label={`cell ${r + 1},${c + 1}${v ? `: ${v}` : ", empty"}`}
            >
              {v === 0 ? "" : String(v)}
            </button>
          ))
        )}
      </div>

      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
      />
    </div>
  );
}

// Check / Reveal / Clear row + a right/wrong status line, shared by all grids.
function GridControls({ onCheck, onReveal, onClear, revealed, status, revealNote }) {
  return (
    <>
      <div className="arcade-solve-controls">
        <button
          type="button"
          className="arcade-solve-btn arcade-solve-check-btn"
          onClick={onCheck}
          disabled={revealed}
        >
          check
        </button>
        <button
          type="button"
          className="arcade-solve-btn arcade-solve-reveal-btn"
          onClick={onReveal}
        >
          reveal
        </button>
        <button type="button" className="arcade-solve-btn arcade-solve-clear-btn" onClick={onClear}>
          clear
        </button>
      </div>
      {status === "right" && (
        <p className="arcade-solve-status is-right">✓ that's it — nicely solved!</p>
      )}
      {status === "wrong" && (
        <p className="arcade-solve-status is-wrong">not quite — keep going.</p>
      )}
      {revealNote && <p className="arcade-solve-status is-reveal">{revealNote}</p>}
    </>
  );
}

// ── dispatcher ───────────────────────────────────────────────────────────--

export default function SolvePuzzle({ puzzle }) {
  if (!puzzle || !puzzle.kind) return null;
  switch (puzzle.kind) {
    case "word_ladder":
      return <WordLadder puzzle={puzzle} />;
    case "cipher":
      return <Cipher puzzle={puzzle} />;
    case "rebus":
      return <Rebus puzzle={puzzle} />;
    case "odd_one_out":
      return <OddOneOut puzzle={puzzle} />;
    case "mystery":
      return <Mystery puzzle={puzzle} />;
    case "nonogram":
      return <Nonogram puzzle={puzzle} />;
    case "sudoku4":
    case "latin4":
      return <NumberGrid puzzle={puzzle} />;
    default:
      return null;
  }
}
