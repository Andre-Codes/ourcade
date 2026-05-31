import { useRef, useState } from "react";

// ── Magic 8-Ball ─────────────────────────────────────────────────────────────
// Self-contained novelty tool. Injects its own theme. Single screen → the
// shell's "‹ BACK TO ARCADE" stays visible (no useArcadeBackButton needed).

const ANSWERS = [
  // affirmative
  { text: "It is certain.", tone: "yes" },
  { text: "It is decidedly so.", tone: "yes" },
  { text: "Without a doubt.", tone: "yes" },
  { text: "Yes — definitely.", tone: "yes" },
  { text: "You may rely on it.", tone: "yes" },
  { text: "As I see it, yes.", tone: "yes" },
  { text: "Most likely.", tone: "yes" },
  { text: "Outlook good.", tone: "yes" },
  { text: "Yes.", tone: "yes" },
  { text: "Signs point to yes.", tone: "yes" },
  // non-committal
  { text: "Reply hazy, try again.", tone: "maybe" },
  { text: "Ask again later.", tone: "maybe" },
  { text: "Better not tell you now.", tone: "maybe" },
  { text: "Cannot predict now.", tone: "maybe" },
  { text: "Concentrate and ask again.", tone: "maybe" },
  // negative
  { text: "Don't count on it.", tone: "no" },
  { text: "My reply is no.", tone: "no" },
  { text: "My sources say no.", tone: "no" },
  { text: "Outlook not so good.", tone: "no" },
  { text: "Very doubtful.", tone: "no" },
];

const TONE = { yes: "#3fffd0", maybe: "#ffd23f", no: "#ff6a8a" };

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #07080f;
    color: #eef0ff;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }

  .eb-app {
    min-height: 100vh; padding: 28px 16px 80px;
    display: flex; flex-direction: column; align-items: center;
    background:
      radial-gradient(ellipse 60% 45% at 50% 0%, rgba(63,255,208,.10), transparent 70%),
      radial-gradient(ellipse 50% 50% at 50% 100%, rgba(180,77,255,.08), transparent 65%),
      #07080f;
  }

  .eb-head { text-align: center; margin-bottom: 24px; }
  .eb-head h1 {
    font-family: 'Black Ops One', 'Impact', sans-serif;
    font-size: clamp(2rem, 7vw, 3.2rem); letter-spacing: 0.06em;
    background: linear-gradient(180deg, #fff, #3fffd0 60%, #b44dff 120%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    text-shadow: 0 0 28px rgba(63,255,208,.3);
  }
  .eb-head .sub { font-size: 0.62rem; letter-spacing: 0.3em; text-transform: uppercase; color: #6b708f; margin-top: 6px; }

  .eb-ask {
    width: min(440px, 92vw); display: flex; gap: 8px; margin-bottom: 34px;
  }
  .eb-input {
    flex: 1; padding: 13px 14px; border-radius: 9px;
    background: #0e101a; color: #eef0ff; border: 2px solid #2a2f4a;
    font-family: 'Share Tech Mono', monospace; font-size: 0.95rem;
  }
  .eb-input:focus { outline: none; border-color: #3fffd0; }
  .eb-go {
    padding: 0 18px; cursor: pointer; border-radius: 9px;
    font-family: 'Press Start 2P', monospace; font-size: 0.66rem; letter-spacing: 0.05em;
    color: #0a0a12; background: linear-gradient(180deg, #fff, #3fffd0); border: 2px solid #0a0a12;
  }
  .eb-go:disabled { opacity: .5; cursor: not-allowed; }

  .eb-ball {
    position: relative; width: min(300px, 80vw); height: min(300px, 80vw);
    border-radius: 50%; cursor: pointer; user-select: none;
    background: radial-gradient(circle at 34% 28%, #4a4f6b 0%, #1a1c28 38%, #050608 78%);
    box-shadow: inset -16px -20px 40px rgba(0,0,0,.85), inset 10px 12px 26px rgba(255,255,255,.08), 0 22px 50px rgba(0,0,0,.6);
    display: flex; align-items: center; justify-content: center;
  }
  .eb-ball::before {
    content: ""; position: absolute; top: 12%; left: 22%;
    width: 26%; height: 18%; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.5), transparent 70%);
    filter: blur(4px);
  }
  .eb-ball.shaking { animation: eb-shake .5s ease-in-out 2; }
  @keyframes eb-shake {
    0%,100% { transform: translate(0,0) rotate(0); }
    20% { transform: translate(-9px,5px) rotate(-5deg); }
    40% { transform: translate(8px,-6px) rotate(4deg); }
    60% { transform: translate(-7px,6px) rotate(-3deg); }
    80% { transform: translate(7px,-4px) rotate(3deg); }
  }

  /* the iconic blue triangle window */
  .eb-window {
    width: 58%; height: 58%; border-radius: 50%;
    background: radial-gradient(circle at 50% 42%, #16345e, #071226 75%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 0 30px rgba(0,0,0,.9);
    overflow: hidden; padding: 8% ;
  }
  .eb-triangle {
    text-align: center; line-height: 1.25;
    font-family: 'Share Tech Mono', monospace; font-weight: 700;
    font-size: clamp(0.78rem, 3.4vw, 1.05rem);
    text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--tone, #9fb4ff);
    text-shadow: 0 0 12px var(--tone, #6a8cff);
    animation: eb-rise .5s ease;
  }
  @keyframes eb-rise { from { opacity: 0; transform: translateY(10px) scale(.85); } to { opacity: 1; transform: none; } }
  .eb-8 { font-family: 'Black Ops One', sans-serif; font-size: 3rem; color: #07080f;
    background: #f4f4f6; width: 64%; height: 64%; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 -6px 10px rgba(0,0,0,.25); }
  .eb-hint { margin-top: 22px; font-size: 0.66rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6b708f; }
`;

export default function MagicEightBall() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [shaking, setShaking] = useState(false);
  const timer = useRef(null);

  const ask = () => {
    if (shaking) return;
    setShaking(true);
    setAnswer(null);
    const a = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAnswer(a);
      setShaking(false);
    }, 1050);
  };

  return (
    <>
      <style>{style}</style>
      <div className="eb-app">
        <div className="eb-head">
          <h1>MAGIC 8-BALL</h1>
          <div className="sub">ask a yes/no question · shake · receive wisdom</div>
        </div>

        <form
          className="eb-ask"
          onSubmit={(e) => { e.preventDefault(); ask(); }}
        >
          <input
            className="eb-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it be a good day?"
            maxLength={120}
          />
          <button className="eb-go" type="submit" disabled={shaking}>ASK</button>
        </form>

        <div
          className={`eb-ball ${shaking ? "shaking" : ""}`}
          onClick={ask}
          role="button"
          aria-label="Shake the magic 8-ball"
        >
          {!answer && !shaking && <div className="eb-8">8</div>}
          {(answer || shaking) && (
            <div className="eb-window">
              {shaking ? (
                <div className="eb-triangle" style={{ "--tone": "#6a8cff" }}>…</div>
              ) : (
                <div className="eb-triangle" style={{ "--tone": TONE[answer.tone] }}>
                  {answer.text}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="eb-hint">— tap the ball to ask again —</div>
      </div>
    </>
  );
}
