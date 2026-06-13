/* Badger's walkman — the hidden easter egg playlist.
   Click the discman in the header mascot's hand (see Walkman.jsx) and these
   spin up in a hidden YouTube player. We store IDs only, never audio files,
   the same "reference, don't bundle" tack as the Flash pool in animations.js.

   Every id below was verified embeddable + correct via the YouTube oEmbed
   endpoint. If one ever dies (deleted / region-locked / embedding disabled),
   the player just skips to the next track (onError in Walkman.jsx), so a stale
   entry can't stall the mix — but it's worth swapping out when noticed.
   Vibe: late-90s / early-2000s only. */

export const TRACKS = [
  { id: "L_jWHffIx5E", title: "All Star", artist: "Smash Mouth", year: 1999 },
  { id: "9Ht5RZpzPqw", title: "All the Small Things", artist: "blink-182", year: 1999 },
  { id: "6Zbi0XmGtMw", title: "We Like to Party", artist: "Vengaboys", year: 1999 },
  { id: "xat1GVnl8-k", title: "The Bad Touch", artist: "Bloodhound Gang", year: 1999 },
  { id: "ZyhrYis509A", title: "Barbie Girl", artist: "Aqua", year: 1997 },
  { id: "gJLIiF15wjQ", title: "Wannabe", artist: "Spice Girls", year: 1996 },
  { id: "Eo-KmOd3i7s", title: "Bye Bye Bye", artist: "*NSYNC", year: 2000 },
  { id: "C-u5WLJ9Yk4", title: "...Baby One More Time", artist: "Britney Spears", year: 1998 },
  { id: "xGytDsqkQY8", title: "Closing Time", artist: "Semisonic", year: 1998 },
  { id: "2H5uWRjFsGc", title: "Tubthumping", artist: "Chumbawamba", year: 1997 },
  { id: "y6120QOlsfU", title: "Sandstorm", artist: "Darude", year: 1999 },
  { id: "1V_xRb0x9aw", title: "Clint Eastwood", artist: "Gorillaz", year: 2001 },
  { id: "PWgvGjAhvIw", title: "Hey Ya!", artist: "OutKast", year: 2003 },
  { id: "CMX2lPum_pg", title: "Fat Lip", artist: "Sum 41", year: 2001 },
  { id: "QtTR-_Klcq8", title: "Pretty Fly (For a White Guy)", artist: "The Offspring", year: 1998 },
  { id: "4iwHb189X84", title: "Blue (Da Ba Dee)", artist: "Eiffel 65", year: 1999 },
  { id: "hTWKbfoikeg", title: "Smells Like Teen Spirit", artist: "Nirvana", year: 1991 },
  { id: "sc5iTNVEOAg", title: "My Own Worst Enemy", artist: "Lit", year: 1999 },
  { id: "fC_q9KPczAg", title: "One Week", artist: "Barenaked Ladies", year: 1998 },
  { id: "wq-S8CIU7VA", title: "California", artist: "Phantom Planet", year: 2002 },
];

// Fisher–Yates copy so the mix order varies per session without mutating TRACKS.
export function shuffled() {
  const a = [...TRACKS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
