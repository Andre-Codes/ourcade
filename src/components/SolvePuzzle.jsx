import { useState } from "react";

/* SolvePuzzle — renders one "Solve This" puzzle inside the /creatives/:id guide
   page (CreativeGuidePage branches here when an item carries a `puzzle`). Two
   families:
     TEXT  (word_ladder, cipher, rebus, odd_one_out, mystery): show the puzzle,
           an optional hint disclosure, and a Reveal Answer toggle.
     GRID  (nonogram, sudoku4, latin4): an interactive fill-in grid with
           Check / Reveal / Clear.
   Self-contained: all the puzzle UI/state lives here so the guide page stays a
   simple branch. Data shape is produced by scripts/gen-solve-puzzles.js. */

// ── shared bits ────────────────────────────────────────────────────────────

// Hint disclosure + Reveal button + revealed answer block, shared by every
// text-family puzzle. `children` is the (always-visible) puzzle body; `answer`
// is rendered only after Reveal.
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

// ── text family ──────────────────────────────────────────────────────────--

function WordLadder({ puzzle }) {
  return (
    <TextPuzzle
      prompt={puzzle.prompt}
      hint={puzzle.hint}
      answer={
        <ol className="arcade-solve-ladder arcade-solve-ladder-answer">
          {puzzle.answer.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
      }
    >
      <ol className="arcade-solve-ladder">
        {puzzle.rungs.map((w, i) => {
          const blank = w === "____";
          return (
            <li key={i} className={blank ? "is-blank" : ""}>
              {blank ? <span className="arcade-solve-blank">????</span> : w}
            </li>
          );
        })}
      </ol>
    </TextPuzzle>
  );
}

function Cipher({ puzzle }) {
  return (
    <TextPuzzle
      prompt={puzzle.prompt}
      hint={puzzle.hint}
      answer={<p className="arcade-solve-mono arcade-solve-plain">{puzzle.answer}</p>}
    >
      <p className="arcade-solve-mono arcade-solve-cipher">{puzzle.ciphertext}</p>
    </TextPuzzle>
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

function OddOneOut({ puzzle }) {
  return (
    <TextPuzzle
      prompt={puzzle.prompt}
      hint={null}
      answer={
        <div>
          <p className="arcade-solve-plain">{puzzle.answer}</p>
          {puzzle.why && <p className="arcade-solve-why">{puzzle.why}</p>}
        </div>
      }
    >
      <ul className="arcade-solve-options">
        {puzzle.items.map((it, i) => (
          <li key={i} className="arcade-solve-option">
            {it}
          </li>
        ))}
      </ul>
    </TextPuzzle>
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
// player types 1–4 into the rest.
function NumberGrid({ puzzle }) {
  const { size, given, solution } = puzzle;
  const init = () => given.map((row) => row.slice());
  const [cells, setCells] = useState(init);
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const locked = (r, c) => given[r][c] !== 0;

  const setCell = (r, c, raw) => {
    if (locked(r, c) || revealed) return;
    setStatus(null);
    const v = raw.replace(/[^1-4]/g, "").slice(-1); // last typed 1–4 digit, or ""
    setCells((prev) => {
      const next = prev.map((row) => row.slice());
      next[r][c] = v ? Number(v) : 0;
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
            <input
              key={`${r}-${c}`}
              className={`arcade-numgrid-cell${locked(r, c) ? " is-locked" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={v === 0 ? "" : String(v)}
              readOnly={locked(r, c) || revealed}
              onChange={(e) => setCell(r, c, e.target.value)}
              aria-label={`cell ${r + 1},${c + 1}`}
            />
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
