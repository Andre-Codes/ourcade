/* Day-part greetings — the mascot's time-of-day welcome on the homepage.
   Hand-written (voice is the whole point here, like facts/curiosities). One
   pool per part; the line is date-seeded within a part via pickDaily, so it's
   stable for everyone in the same part on the same day but fresh day to day.
   Pure JS — importable by the home UI and by scripts/daily-check.js. */

import { pickDaily } from "../lib/daily.js";

// Keyed by the part id from daily.js DAY_PARTS (morning/afternoon/evening/night).
const GREETINGS = {
  morning: [
    "morning, visitor. coffee's brewing, the cabinets are warming up.",
    "first quarter of the day. the place smells like possibility and old carpet.",
    "you're up early. the high scores haven't been beaten yet — go.",
    "good morning! the marquee's still stretching. pull up a stool anyway.",
    "rise and grind your way to a new high score. or just vibe. no pressure.",
    "the arcade just unlocked its doors. you're the first one in.",
    "morning shift at OURCADE. dust's settled, screens are glowing. welcome back.",
    "early bird gets the working cabinet. (they all work. it's a metaphor.)",
  ],
  afternoon: [
    "afternoon rush! every cabinet's lit and the marquee's screaming. dive in.",
    "peak hours. somewhere a high score is falling. probably not ours.",
    "prime time at the arcade. grab a token, the day's wide open.",
    "the floor's buzzing. pick a cabinet, any cabinet.",
    "full daylight, full neon. this is the arcade at its loudest.",
    "lunch-break legends welcome. you've got time for one more round.",
    "the good afternoon energy is real. spend it on something delightfully pointless.",
  ],
  evening: [
    "after hours. golden light through the front glass — wind down with a game.",
    "evening, visitor. the rush is over, the good seats are open.",
    "the sun's clocking out. the arcade's just hitting its stride.",
    "settle in. this is the cozy part of the day, neon and all.",
    "dinnertime for some, prime stumble hours for you. welcome back.",
    "the marquee glows a little warmer now. stay a while.",
    "evening shift. quieter, moodier, somehow better. pick a cabinet.",
  ],
  night: [
    "can't sleep either, huh? the good weird stuff comes out now.",
    "welcome back, night owl. day-folk are missing the best hour.",
    "it's late. the cabinets hum a little lower. just us in here.",
    "the witching hour at OURCADE. something stranger's on the screen tonight.",
    "still up? same. the after-dark arcade keeps its own hours.",
    "quiet now. just you, the glow, and whatever's lurking in the dice.",
    "late-night visitors get the secret stuff. you know the deal.",
    "the closing-time arcade never actually closes. lucky you.",
  ],
};

const FALLBACK = "welcome back to OURCADE. pull up a stool.";
const SALT = 808; // independent of every other rotation

// Today's greeting for this part — stable per (day, part), fresh day to day.
export function getDayPartGreeting(part, key) {
  const pool = GREETINGS[part?.id];
  if (!pool || !pool.length) return FALLBACK;
  // salt by part so each part draws independently from the same day key
  return pickDaily(pool, key, SALT + (part.index ?? 0));
}
