import { useEffect, useMemo, useRef, useState } from "react";
import { markSolved } from "../lib/solveState.js";

/* SolvePuzzle — renders one "Solve This" puzzle inside the /action-lab/:id guide
   page (CreativeGuidePage branches here when an item carries a `puzzle`). Most
   puzzles are now a "try it → check" loop sharing the GridControls bar
   (Check / Reveal / Clear + a right/wrong status line):
     INTERACTIVE (check): word_ladder (type the blanks), anagram (unscramble),
           middle (word sandwich), cipher (type the decoded phrase), pattern
           (type the next term), nonogram, sudoku4, latin4.
     REVEAL-ONLY (TextPuzzle): rebus + mystery — their answers are free-form
           phrases, so they keep the hint + Reveal Answer disclosure only.
   Self-contained: all the puzzle UI/state lives here so the guide page stays a
   simple branch. Data shape is produced by scripts/gen-solve-puzzles.js.

   A correct check records the completion (markSolved(itemId)) so the Action Lab
   card can show a ✓ solved badge for a week. `itemId` is threaded to each
   renderer; a missing id just no-ops the mark. */

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

// One underscore per letter of the answer, so the blank in a word-sandwich clue
// visually matches how long the missing word is (a 3-letter answer shows "___",
// a 5-letter answer shows "_____"). Used by WordSandwich.
const BLANKS = (n) => "_".repeat(Math.max(1, n | 0));

// Set the check status and, when the answer is right, record the completion so the
// Action Lab card shows a ✓ solved badge. Every interactive renderer routes its
// check through here to keep the "mark on solve" behavior in one place.
const settle = (setStatus, ok, itemId) => {
  setStatus(ok ? "right" : "wrong");
  if (ok) markSolved(itemId);
};

// ── text family ──────────────────────────────────────────────────────────--

// Word ladder: type the missing rungs, then check. A blank is right when it
// matches the canonical answer at that position (case-insensitive); first/last
// rungs are given. Reveal fills every rung; clear empties the typed blanks.
function WordLadder({ puzzle, itemId }) {
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
    settle(setStatus, ok, itemId);
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

  // Width = glyph cells + the per-letter 0.3em letter-spacing + side padding,
  // so every letter shows (a plain `${len}ch` clips, since `ch` ignores the
  // letter-spacing each character adds).
  const rungWidth = (len) => `calc(${len}ch + ${len} * 0.3em + 16px)`;

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
                style={{ width: rungWidth(puzzle.answer[i].length) }}
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
function Cipher({ puzzle, itemId }) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const check = () =>
    settle(setStatus, normalizeAnswer(guess) === normalizeAnswer(puzzle.answer), itemId);
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

// Word Sprint (kind:"anagram"): a 30-second speed round. Seven scrambled letters
// are shown; type as many real words (4+ letters) as you can before the clock
// runs out. The generator pre-computed the full valid-word set (`puzzle.words`),
// so the check is a cheap membership test — no runtime dictionary. Each unique
// find scores by length; solving records a completion once the round ends with
// any finds. A word may be built from the rack's letters (letters can't be reused
// more than they appear), which the pre-computed set already guarantees.
const SPRINT_SECONDS = 30;

function WordSprint({ puzzle, itemId }) {
  const wordSet = useMemo(
    () => new Set((puzzle.words || []).map((w) => w.toUpperCase())),
    [puzzle.words]
  );
  const total = puzzle.total ?? wordSet.size;

  const [phase, setPhase] = useState("ready"); // ready | running | done
  const [left, setLeft] = useState(SPRINT_SECONDS);
  const [guess, setGuess] = useState("");
  const [found, setFound] = useState([]); // words the player has landed, newest first
  const [flash, setFlash] = useState(null); // { kind:"hit"|"dupe"|"miss", word }
  const foundSet = useMemo(() => new Set(found), [found]);
  const tickRef = useRef(null);
  const flashRef = useRef(null);

  // Count down while running; stop at 0.
  useEffect(() => {
    if (phase !== "running") return undefined;
    tickRef.current = window.setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          window.clearInterval(tickRef.current);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(tickRef.current);
  }, [phase]);

  // On finishing with at least one find, mark the item solved.
  useEffect(() => {
    if (phase === "done" && found.length > 0) markSolved(itemId);
  }, [phase, found.length, itemId]);

  useEffect(() => () => {
    window.clearInterval(tickRef.current);
    window.clearTimeout(flashRef.current);
  }, []);

  const showFlash = (kind, word) => {
    setFlash({ kind, word });
    window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setFlash(null), 1100);
  };

  const start = () => {
    setPhase("running");
    setLeft(SPRINT_SECONDS);
    setFound([]);
    setGuess("");
    setFlash(null);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    if (phase !== "running") return;
    const w = normalizeAnswer(guess);
    setGuess("");
    if (w.length < 4) { showFlash("miss", w); return; }
    if (foundSet.has(w)) { showFlash("dupe", w); return; }
    if (!wordSet.has(w)) { showFlash("miss", w); return; }
    setFound((prev) => [w, ...prev]);
    showFlash("hit", w);
  };

  const score = found.reduce((s, w) => s + w.length, 0);
  const timeLow = phase === "running" && left <= 5;

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      {/* the rack — big scrambled letters */}
      <p className="arcade-solve-mono arcade-solve-cipher arcade-sprint-rack">
        {puzzle.scramble.split("").join(" ")}
      </p>

      {phase === "ready" && (
        <>
          <HintToggle hint={puzzle.hint} />
          <div className="arcade-solve-controls">
            <button
              type="button"
              className="arcade-solve-btn arcade-solve-check-btn"
              onClick={start}
            >
              start 30s sprint
            </button>
          </div>
        </>
      )}

      {phase === "running" && (
        <>
          <div className="arcade-sprint-hud">
            <span className={`arcade-sprint-timer${timeLow ? " is-low" : ""}`}>⏱ {left}s</span>
            <span className="arcade-sprint-count">{found.length} found · {score} pts</span>
          </div>

          <form onSubmit={submit} className="arcade-sprint-form">
            <input
              className="arcade-solve-input arcade-solve-cipher-input"
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="type a word, hit enter…"
              aria-label="your word"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
            />
          </form>

          {flash && (
            <p className={`arcade-solve-status arcade-sprint-flash is-${flash.kind}`}>
              {flash.kind === "hit" && `✓ ${flash.word} (+${flash.word.length})`}
              {flash.kind === "dupe" && `already found ${flash.word}`}
              {flash.kind === "miss" && (flash.word.length < 4 ? "words need 4+ letters" : `${flash.word} isn't in the list`)}
            </p>
          )}

          {found.length > 0 && (
            <div className="arcade-sprint-found">
              {found.map((w) => (
                <span key={w} className="arcade-sprint-chip">{w}</span>
              ))}
            </div>
          )}
        </>
      )}

      {phase === "done" && (
        <div className="arcade-sprint-result">
          <p className="arcade-solve-status is-right">
            ⏱ time! You found <b>{found.length}</b> of {total} words · <b>{score}</b> points.
          </p>
          {found.length > 0 && (
            <div className="arcade-sprint-found">
              {found.map((w) => (
                <span key={w} className="arcade-sprint-chip">{w}</span>
              ))}
            </div>
          )}
          {puzzle.pangrams?.length > 0 && (
            <p className="arcade-solve-hint">
              Used all 7 letters: {puzzle.pangrams.join(", ")}
              {found.some((w) => puzzle.pangrams.includes(w)) ? " — and you got it! 🏆" : ""}
            </p>
          )}
          <div className="arcade-solve-controls">
            <button
              type="button"
              className="arcade-solve-btn arcade-solve-reveal-btn"
              onClick={start}
            >
              play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Word sandwich: one short word completes both LEFT___ and ___RIGHT. Type the
// connector, then check. Same loop as Cipher/Anagram.
function WordSandwich({ puzzle, itemId }) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const check = () =>
    settle(setStatus, normalizeAnswer(guess) === normalizeAnswer(puzzle.answer), itemId);
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
      <p className="arcade-solve-mono arcade-solve-cipher">
        {puzzle.left}{BLANKS(puzzle.answer.length)} &nbsp;+&nbsp; {BLANKS(puzzle.answer.length)}{puzzle.right}
      </p>

      <input
        className="arcade-solve-input arcade-solve-cipher-input"
        type="text"
        value={guess}
        readOnly={revealed}
        maxLength={puzzle.answer.length}
        onChange={(e) => {
          setStatus(null);
          setGuess(e.target.value);
        }}
        placeholder="the word that fits both…"
        aria-label="your connecting word"
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

// Complete the pattern: the first terms of a sequence are shown with a trailing
// "?"; type the next term, then check. The answer compares loosely (spacing/case
// ignored, so "1 3" or "13" both count for 13). Reveal fills the answer and, if
// present, explains the rule; clear empties the input. Works for known sequences
// (Fibonacci, squares, …) and hand-authored invented ones (see manual/creatives.js).
function Pattern({ puzzle, itemId }) {
  const [guess, setGuess] = useState("");
  const [status, setStatus] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const check = () =>
    settle(setStatus, normalizeAnswer(guess) === normalizeAnswer(puzzle.answer), itemId);
  const doReveal = () => {
    setRevealed(true);
    setStatus(null);
    setGuess(String(puzzle.answer));
  };
  const reset = () => {
    setRevealed(false);
    setStatus(null);
    setGuess("");
  };

  return (
    <div className="arcade-solve">
      {puzzle.prompt && <p className="arcade-solve-prompt">{puzzle.prompt}</p>}

      <p className="arcade-solve-mono arcade-solve-pattern">
        {puzzle.sequence.map((t, i) => (
          <span key={i} className="arcade-solve-pattern-term">{t}</span>
        ))}
        <span className="arcade-solve-pattern-term is-next">?</span>
      </p>

      <input
        className="arcade-solve-input arcade-solve-cipher-input"
        type="text"
        value={guess}
        readOnly={revealed}
        onChange={(e) => {
          setStatus(null);
          setGuess(e.target.value);
        }}
        placeholder="what comes next…"
        aria-label="the next term in the pattern"
        autoComplete="off"
        spellCheck={false}
      />

      <HintToggle hint={puzzle.hint} />
      <GridControls
        onCheck={check}
        onReveal={doReveal}
        onClear={reset}
        revealed={revealed}
        status={status}
        revealNote={revealed && puzzle.rule ? puzzle.rule : null}
      />
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

function Nonogram({ puzzle, itemId }) {
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
    settle(setStatus, ok, itemId);
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
        // Name the picture both on a correct solve AND on reveal — so a player
        // who cracks it themselves still learns what the pixel art depicts.
        solvedNote={`The picture is ${reveal}!`}
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
function NumberGrid({ puzzle, itemId }) {
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
    settle(setStatus, ok, itemId);
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
function GridControls({ onCheck, onReveal, onClear, revealed, status, revealNote, solvedNote }) {
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
        <p className="arcade-solve-status is-right">
          ✓ that's it — nicely solved!{solvedNote ? ` ${solvedNote}` : ""}
        </p>
      )}
      {status === "wrong" && (
        <p className="arcade-solve-status is-wrong">not quite — keep going.</p>
      )}
      {revealNote && <p className="arcade-solve-status is-reveal">{revealNote}</p>}
    </>
  );
}

// ── dispatcher ───────────────────────────────────────────────────────────--

export default function SolvePuzzle({ puzzle, itemId }) {
  if (!puzzle || !puzzle.kind) return null;
  switch (puzzle.kind) {
    case "word_ladder":
      return <WordLadder puzzle={puzzle} itemId={itemId} />;
    case "anagram":
      return <WordSprint puzzle={puzzle} itemId={itemId} />;
    case "middle":
      return <WordSandwich puzzle={puzzle} itemId={itemId} />;
    case "cipher":
      return <Cipher puzzle={puzzle} itemId={itemId} />;
    case "rebus":
      return <Rebus puzzle={puzzle} />;
    case "pattern":
      return <Pattern puzzle={puzzle} itemId={itemId} />;
    case "mystery":
      return <Mystery puzzle={puzzle} />;
    case "nonogram":
      return <Nonogram puzzle={puzzle} itemId={itemId} />;
    case "sudoku4":
    case "latin4":
      return <NumberGrid puzzle={puzzle} itemId={itemId} />;
    default:
      return null;
  }
}
