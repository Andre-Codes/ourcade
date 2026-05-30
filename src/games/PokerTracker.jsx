import { useState, useMemo } from "react";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0a;
    color: #e8dcc8;
    font-family: 'IBM Plex Mono', monospace;
  }

  .app {
    min-height: 100vh;
    background: 
      radial-gradient(ellipse at 20% 50%, rgba(139,90,43,0.08) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(180,140,60,0.06) 0%, transparent 50%),
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 60px,
        rgba(255,255,255,0.01) 60px,
        rgba(255,255,255,0.01) 61px
      ),
      #0a0a0a;
    padding: 32px 16px 80px;
  }

  .header {
    text-align: center;
    margin-bottom: 40px;
  }

  .header h1 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(2rem, 6vw, 3.5rem);
    font-weight: 900;
    letter-spacing: 0.04em;
    color: #c8a84b;
    text-shadow: 0 0 40px rgba(200,168,75,0.3);
    line-height: 1;
  }

  .header .subtitle {
    font-size: 0.65rem;
    letter-spacing: 0.3em;
    color: #6b5d45;
    margin-top: 6px;
    text-transform: uppercase;
  }

  .divider {
    width: 120px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c8a84b, transparent);
    margin: 12px auto;
  }

  .container {
    max-width: 720px;
    margin: 0 auto;
  }

  .phase-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 28px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(200,168,75,0.15);
    border-radius: 4px;
    padding: 3px;
  }

  .tab {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    color: #6b5d45;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.2s;
  }

  .tab.active {
    background: rgba(200,168,75,0.15);
    color: #c8a84b;
  }

  .tab:hover:not(.active) {
    color: #a08840;
  }

  .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(200,168,75,0.12);
    border-radius: 6px;
    padding: 20px;
    margin-bottom: 12px;
  }

  .card-title {
    font-size: 0.6rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #c8a84b;
    margin-bottom: 16px;
  }

  .input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    align-items: stretch;
  }

  input {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(200,168,75,0.2);
    border-radius: 3px;
    color: #e8dcc8;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8rem;
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.2s;
    height: 40px;
    min-width: 0;
  }

  input:focus {
    border-color: rgba(200,168,75,0.5);
  }

  input::placeholder {
    color: #3a3020;
  }

  input.name-input { flex: 2; }
  input.money-input { flex: 1; min-width: 90px; }

  .btn {
    padding: 0 18px;
    height: 40px;
    border: none;
    border-radius: 3px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-gold {
    background: rgba(200,168,75,0.15);
    border: 1px solid rgba(200,168,75,0.4);
    color: #c8a84b;
  }

  .btn-gold:hover {
    background: rgba(200,168,75,0.25);
    box-shadow: 0 0 12px rgba(200,168,75,0.15);
  }

  .btn-danger {
    background: rgba(180,60,60,0.1);
    border: 1px solid rgba(180,60,60,0.3);
    color: #b44040;
    padding: 4px 10px;
    font-size: 0.6rem;
  }

  .btn-danger:hover { background: rgba(180,60,60,0.2); }

  .player-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .player-row:last-child { border-bottom: none; }

  .player-name {
    font-size: 0.85rem;
    color: #e8dcc8;
  }

  .player-meta {
    font-size: 0.65rem;
    color: #6b5d45;
    margin-top: 2px;
  }

  .amount {
    font-size: 0.8rem;
    font-weight: 600;
    text-align: right;
  }

  .amount.positive { color: #5aaa6a; }
  .amount.negative { color: #cc5555; }
  .amount.neutral { color: #6b5d45; }

  .chips-input {
    width: 90px;
    text-align: right;
  }

  .pot-display {
    text-align: center;
    padding: 20px;
    margin-bottom: 20px;
  }

  .pot-label {
    font-size: 0.6rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #6b5d45;
  }

  .pot-amount {
    font-family: 'Playfair Display', serif;
    font-size: 2.8rem;
    color: #c8a84b;
    font-weight: 700;
    line-height: 1.1;
    text-shadow: 0 0 30px rgba(200,168,75,0.2);
  }

  .pot-detail {
    font-size: 0.65rem;
    color: #4a3d2a;
    margin-top: 4px;
  }

  .settlement-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 0.78rem;
  }

  .settlement-row:last-child { border-bottom: none; }

  .arrow { color: #c8a84b; font-size: 1rem; }

  .payer { color: #cc5555; font-weight: 600; }
  .payee { color: #5aaa6a; font-weight: 600; }
  .settle-amount { 
    margin-left: auto; 
    color: #c8a84b; 
    font-weight: 600;
    font-size: 0.85rem;
  }

  .chip-ratio {
    text-align: center;
    font-size: 0.65rem;
    color: #4a3d2a;
    margin-bottom: 20px;
    letter-spacing: 0.1em;
  }

  .chip-ratio span { color: #8a7040; }

  .empty-state {
    text-align: center;
    padding: 30px;
    color: #3a3020;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
  }

  .rebuy-badge {
    background: rgba(200,168,75,0.1);
    border: 1px solid rgba(200,168,75,0.2);
    color: #8a7040;
    font-size: 0.55rem;
    padding: 2px 6px;
    border-radius: 2px;
    letter-spacing: 0.1em;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
  }

  .stat-box {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(200,168,75,0.1);
    border-radius: 4px;
    padding: 12px;
    text-align: center;
  }

  .stat-value {
    font-family: 'Playfair Display', serif;
    font-size: 1.3rem;
    color: #c8a84b;
    font-weight: 700;
  }

  .stat-label {
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #4a3d2a;
    margin-top: 2px;
  }

  .warning {
    background: rgba(200,100,40,0.08);
    border: 1px solid rgba(200,100,40,0.2);
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 0.65rem;
    color: #b87030;
    letter-spacing: 0.05em;
    margin-bottom: 14px;
  }
`;

// Settle up using greedy debt-reduction algorithm (minimum transactions)
function settleDebts(players) {
  const balances = players.map(p => ({ name: p.name, bal: p.finalChips !== "" ? (parseFloat(p.finalChips) * p.chipValue) - p.totalBuyIn : 0 }));
  const creditors = balances.filter(b => b.bal > 0.005).sort((a, b) => b.bal - a.bal);
  const debtors = balances.filter(b => b.bal < -0.005).sort((a, b) => a.bal - b.bal);

  const txns = [];
  let ci = 0, di = 0;
  const creds = creditors.map(c => ({ ...c }));
  const debts = debtors.map(d => ({ ...d }));

  while (ci < creds.length && di < debts.length) {
    const amount = Math.min(creds[ci].bal, -debts[di].bal);
    txns.push({ from: debts[di].name, to: creds[ci].name, amount: Math.round(amount * 100) / 100 });
    creds[ci].bal -= amount;
    debts[di].bal += amount;
    if (Math.abs(creds[ci].bal) < 0.005) ci++;
    if (Math.abs(debts[di].bal) < 0.005) di++;
  }
  return txns;
}

export default function PokerTracker() {
  const [phase, setPhase] = useState("setup");
  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newBuyIn, setNewBuyIn] = useState("");
  const [chipRatio, setChipRatio] = useState(""); // chips per dollar

  const totalPot = useMemo(() => players.reduce((s, p) => s + p.totalBuyIn, 0), [players]);
  const totalChips = useMemo(() => players.reduce((s, p) => s + p.chipsBought, 0), [players]);
  const chipValue = chipRatio ? 1 / parseFloat(chipRatio) : null; // $ per chip

  const addPlayer = () => {
    const name = newName.trim();
    const buyIn = parseFloat(newBuyIn);
    if (!name || isNaN(buyIn) || buyIn <= 0) return;
    if (!chipRatio || isNaN(parseFloat(chipRatio)) || parseFloat(chipRatio) <= 0) return;
    const chips = buyIn * parseFloat(chipRatio);
    setPlayers(prev => [...prev, {
      id: Date.now(),
      name,
      totalBuyIn: buyIn,
      chipsBought: chips,
      chipValue: 1 / parseFloat(chipRatio),
      finalChips: "",
      rebuys: 0,
    }]);
    setNewName("");
    setNewBuyIn("");
  };

  const removePlayer = (id) => setPlayers(prev => prev.filter(p => p.id !== id));

  const addRebuy = (id) => {
    const amount = parseFloat(newBuyIn) || players.find(p => p.id === id)?.totalBuyIn / (players.find(p => p.id === id)?.rebuys + 1) || 0;
    // Use a prompt-like approach: just add the original buy-in amount
    const player = players.find(p => p.id === id);
    if (!player) return;
    const rebuyAmt = player.totalBuyIn / Math.max(1, player.rebuys + 1) || 20;
    setPlayers(prev => prev.map(p => p.id === id ? {
      ...p,
      totalBuyIn: p.totalBuyIn + rebuyAmt,
      chipsBought: p.chipsBought + rebuyAmt * parseFloat(chipRatio),
      rebuys: p.rebuys + 1,
    } : p));
  };

  const setFinalChips = (id, val) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, finalChips: val } : p));
  };

  const allChipsEntered = players.length > 0 && players.every(p => p.finalChips !== "" && !isNaN(parseFloat(p.finalChips)));

  const totalFinalChips = players.reduce((s, p) => s + (p.finalChips !== "" ? parseFloat(p.finalChips) : 0), 0);
  const chipsBalance = totalFinalChips - totalChips;

  const settlements = useMemo(() => {
    if (!allChipsEntered) return [];
    return settleDebts(players);
  }, [players, allChipsEntered]);

  const netResults = useMemo(() => {
    if (!allChipsEntered) return [];
    return players.map(p => ({
      name: p.name,
      net: (parseFloat(p.finalChips) * p.chipValue) - p.totalBuyIn,
      cashOut: parseFloat(p.finalChips) * p.chipValue,
      buyIn: p.totalBuyIn,
    })).sort((a, b) => b.net - a.net);
  }, [players, allChipsEntered]);

  return (
    <>
      <style>{style}</style>
      <div className="app">
        <div className="header">
          <h1>Felt & Ledger</h1>
          <div className="divider" />
          <div className="subtitle">Poker Night Settlement Tracker</div>
        </div>

        <div className="container">
          <div className="phase-tabs">
            {["setup", "cashout", "settle"].map(p => (
              <button key={p} className={`tab ${phase === p ? "active" : ""}`} onClick={() => setPhase(p)}>
                {p === "setup" ? "① Buy-In" : p === "cashout" ? "② Cash Out" : "③ Settle Up"}
              </button>
            ))}
          </div>

          {/* ── SETUP PHASE ── */}
          {phase === "setup" && (
            <>
              <div className="card">
                <div className="card-title">Chip Conversion</div>
                <div className="input-row">
                  <input
                    className="money-input"
                    placeholder="Chips per $1"
                    value={chipRatio}
                    onChange={e => setChipRatio(e.target.value)}
                    type="number"
                    min="1"
                  />
                </div>
                {chipRatio && !isNaN(parseFloat(chipRatio)) && parseFloat(chipRatio) > 0 && (
                  <div style={{ fontSize: "0.65rem", color: "#8a7040", marginTop: 8, letterSpacing: "0.05em" }}>
                    1 chip = ${(1 / parseFloat(chipRatio)).toFixed(4)} &nbsp;·&nbsp; $1 buys {parseFloat(chipRatio)} chips
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-title">Add Player</div>
                <div className="input-row">
                  <input className="name-input" placeholder="Player name" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addPlayer()} />
                  <input className="money-input" placeholder="Buy-in $" value={newBuyIn} onChange={e => setNewBuyIn(e.target.value)} type="number" min="1"
                    onKeyDown={e => e.key === "Enter" && addPlayer()} />
                  <button className="btn btn-gold" onClick={addPlayer}>Add</button>
                </div>
              </div>

              {players.length > 0 && (
                <div className="card">
                  <div className="card-title">Players</div>
                  {players.map(p => (
                    <div className="player-row" key={p.id}>
                      <div>
                        <div className="player-name">{p.name}</div>
                        <div className="player-meta">{p.chipsBought.toLocaleString()} chips{p.rebuys > 0 && ` · ${p.rebuys} rebuy${p.rebuys > 1 ? "s" : ""}`}</div>
                      </div>
                      {p.rebuys > 0 && <span className="rebuy-badge">+{p.rebuys} rebuy</span>}
                      <div className="amount neutral">${p.totalBuyIn}</div>
                      <button className="btn btn-danger" onClick={() => removePlayer(p.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {players.length > 0 && (
                <div className="pot-display">
                  <div className="pot-label">Total Pot</div>
                  <div className="pot-amount">${totalPot.toFixed(2)}</div>
                  <div className="pot-detail">{players.length} players · {totalChips.toLocaleString()} chips in play</div>
                </div>
              )}
            </>
          )}

          {/* ── CASHOUT PHASE ── */}
          {phase === "cashout" && (
            <>
              {players.length === 0
                ? <div className="empty-state">No players yet — go to Buy-In first</div>
                : (
                  <>
                    <div className="chip-ratio">
                      Chip value: <span>1 chip = ${players[0]?.chipValue.toFixed(4)}</span> · Total pot: <span>${totalPot.toFixed(2)}</span>
                    </div>

                    {allChipsEntered && Math.abs(chipsBalance) > 0.5 && (
                      <div className="warning">
                        ⚠ Chip count mismatch: {chipsBalance > 0 ? "+" : ""}{chipsBalance.toFixed(0)} chips ({chipsBalance > 0 ? "+" : ""}${(chipsBalance * players[0]?.chipValue).toFixed(2)}). Check counts before settling.
                      </div>
                    )}

                    <div className="card">
                      <div className="card-title">Enter Final Chip Counts</div>
                      {players.map(p => (
                        <div className="player-row" key={p.id}>
                          <div>
                            <div className="player-name">{p.name}</div>
                            <div className="player-meta">Bought in: ${p.totalBuyIn} · {p.chipsBought.toLocaleString()} chips</div>
                          </div>
                          <input
                            className="chips-input"
                            placeholder="Final chips"
                            value={p.finalChips}
                            onChange={e => setFinalChips(p.id, e.target.value)}
                            type="number"
                            min="0"
                          />
                          {p.finalChips !== "" && !isNaN(parseFloat(p.finalChips)) && (
                            <div className={`amount ${(parseFloat(p.finalChips) * p.chipValue - p.totalBuyIn) >= 0 ? "positive" : "negative"}`}>
                              {(parseFloat(p.finalChips) * p.chipValue - p.totalBuyIn) >= 0 ? "+" : ""}
                              ${(parseFloat(p.finalChips) * p.chipValue - p.totalBuyIn).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {players.some(p => p.rebuys === 0) && (
                      <div className="card" style={{ marginTop: 12 }}>
                        <div className="card-title">Add Rebuy</div>
                        <div style={{ fontSize: "0.65rem", color: "#6b5d45", marginBottom: 10 }}>Adds original buy-in amount as a rebuy</div>
                        {players.map(p => (
                          <div className="player-row" key={p.id}>
                            <div className="player-name">{p.name}</div>
                            <button className="btn btn-gold" style={{ fontSize: "0.6rem", padding: "5px 10px" }} onClick={() => addRebuy(p.id)}>
                              + Rebuy ${(p.totalBuyIn / Math.max(1, p.rebuys + 1)).toFixed(0)}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
            </>
          )}

          {/* ── SETTLE PHASE ── */}
          {phase === "settle" && (
            <>
              {!allChipsEntered
                ? <div className="empty-state">Enter all final chip counts in Cash-Out first</div>
                : (
                  <>
                    <div className="summary-grid">
                      <div className="stat-box">
                        <div className="stat-value">${totalPot.toFixed(0)}</div>
                        <div className="stat-label">Total Pot</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{players.length}</div>
                        <div className="stat-label">Players</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{settlements.length}</div>
                        <div className="stat-label">Payments</div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-title">Results</div>
                      {netResults.map(r => (
                        <div className="player-row" key={r.name}>
                          <div>
                            <div className="player-name">{r.name}</div>
                            <div className="player-meta">Cashed out ${r.cashOut.toFixed(2)} · Bought in ${r.buyIn.toFixed(2)}</div>
                          </div>
                          <div className={`amount ${r.net > 0.005 ? "positive" : r.net < -0.005 ? "negative" : "neutral"}`}>
                            {r.net > 0.005 ? "+" : ""}{r.net.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="card">
                      <div className="card-title">Settlement Instructions</div>
                      {settlements.length === 0
                        ? <div className="empty-state" style={{ padding: "10px 0" }}>All square — no payments needed 🃏</div>
                        : settlements.map((t, i) => (
                          <div className="settlement-row" key={i}>
                            <span className="payer">{t.from}</span>
                            <span className="arrow">→</span>
                            <span className="payee">{t.to}</span>
                            <span className="settle-amount">${t.amount.toFixed(2)}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
