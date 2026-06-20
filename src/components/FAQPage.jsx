import BackBar from "./BackBar.jsx";

/* /faq — a deliberately old-school FAQ. Numbered Q&A with a table-of-contents
   jump list up top, <hr> dividers, and a "last updated" line, like a genuine
   2000s help page — but inside the arcade shell (BackBar) and tuned for the
   dark theme via the .arcade-faq styles. Content is hand-written here (no data
   file): it's the canonical explanation of what Ourcade is, why it exists, and
   what's on it. Edit the FAQS array to add/adjust questions. */

const FAQS = [
  {
    id: "q1",
    q: "What is Ourcade?",
    a: [
      "Ourcade is a little corner of the old internet that someone forgot to shut down. It's an arcade, a water cooler, a junk drawer of the web — a finite, hand-built page you visit, not a feed you fall into.",
      "There's no infinite scroll, no recommendation engine deciding what you see next. It's the same page for everyone today, and a different page tomorrow.",
    ],
  },
  {
    id: "q2",
    q: "Why was this built?",
    a: [
      "Because the modern web optimizes you instead of delighting you. Every site is a slot machine tuned to keep you pulling the lever.",
      "Ourcade is the opposite of that: a place with edges. You can reach the bottom. It's curated by a human, it ends, and then you go live your life. Nostalgia is the bait; the point is an internet that respects your attention.",
    ],
  },
  {
    id: "q3",
    q: "What can I actually do here?",
    a: [
      "Plenty. The Games shelf has original cabinets you can play in the browser. Today's Arcade (the daily band on the home page) refreshes every day with a tip, the site news, a daily poll, and odd curiosities.",
      "The Daily Run is a deterministic \"old internet maze\" — everyone gets the same start and target page each day and races to find the lost page in the fewest clicks. The Water Cooler is the pop-culture page: today's countdown, on-this-day, the buzz, and a Hot-or-Not. /stumble flings you at a random artifact from the web. And there's a Phone you can use to text other Ourcade members.",
    ],
  },
  {
    id: "q4",
    q: "What's the Water Cooler?",
    a: [
      "It's where everyone \"gathers\" — a 2000s e-zine version of what's-everyone-talking-about. Four date-seeded sections every day: The Countdown (a top-5 chart), On This Day, The Buzz (short gossip blurbs), and Hot or Not (you vote).",
      "No algorithm, no feed — just a finite page that's a different place each day. Look for the aqua 💧 WATER COOLER button in the top nav.",
    ],
  },
  {
    id: "q5",
    q: "What are relics? (the little 💾 things)",
    a: [
      "Relics are hidden collectibles scattered around Ourcade — golden floppy disks, rarer CDs, and the occasional something special. The Magic 8-Ball drops them on rare rolls, and a few are tucked away as easter eggs in places like the Daily Run, waiting for someone curious enough to click the right thing.",
      "Find one and it's saved to your profile forever. We're not going to tell you where they all are — that's the fun.",
    ],
  },
  {
    id: "q6",
    q: "Do I need an account?",
    a: [
      "No — almost everything works without signing in, and your progress is saved on your device. Claim a free account (the 👤 button) if you want a public profile, a high-score handle, your relic collection and favorites synced across devices, and your own Ourcade phone number.",
    ],
  },
  {
    id: "q7",
    q: "Is this finished? Who made it?",
    a: [
      "It's never finished — new cabinets, relics, and oddities land over time (watch the SITE NEWS for what's new). It's a labor of love built by one person who misses when the web was weird.",
      "Thanks for stopping by. Now go play something.",
    ],
  },
];

export default function FAQPage() {
  // HashRouter owns the URL hash (#/faq), so bare #id anchors clobber the route
  // instead of scrolling. Jump programmatically and keep the route intact.
  const jumpTo = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="arcade-stage">
      <BackBar />

      <div className="arcade-faq" id="faq-top">
        <span className="arcade-widget-kicker">❓ FREQUENTLY ASKED QUESTIONS</span>
        <h1 className="arcade-faq-title">Ourcade F.A.Q.</h1>
        <p className="arcade-faq-updated">Last updated: June 2026</p>

        <nav className="arcade-faq-toc" aria-label="FAQ contents">
          <p className="arcade-faq-toc-head">CONTENTS</p>
          <ol>
            {FAQS.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} onClick={(e) => jumpTo(e, item.id)}>{item.q}</a>
              </li>
            ))}
          </ol>
        </nav>

        {FAQS.map((item, i) => (
          <div key={item.id}>
            <hr />
            <h2 className="arcade-faq-q" id={item.id}>
              <span className="arcade-faq-num">{i + 1}.</span>
              {item.q}
            </h2>
            {item.a.map((para, j) => (
              <p key={j} className="arcade-faq-a">{para}</p>
            ))}
            <a className="arcade-faq-top" href="#faq-top" onClick={(e) => jumpTo(e, "faq-top")}>↑ back to top</a>
          </div>
        ))}
      </div>
    </div>
  );
}
