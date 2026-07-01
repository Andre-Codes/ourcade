# ENABLE WORDS LIST SORTED BY LENGTH

This was created for the purpose of a code-golf challenge, but if you happen upon this dictionary of words and want to use it, feel free. This is, simply put, the dictionary of "ENABLE" with expletives deleted (around 409 words removed) and a couple words added (around 109 word additions). This was the base that was used in the game "Words with Friends", which is the ENABLE dictionary with the edits mentioned.

The length-sorted `<n>.txt` files (ENABLE) are the exhaustive dictionary used to
VALIDATE and DISCOVER — any word a player might reasonably type, plus the raw
letter-set discovery for the daily word games. They are intentionally permissive
(they include lots of obscure-but-valid words).

---

## `common-10k.txt` — curated common-words list (Spelldown answers)

A small, everyday-English list used to CURATE answer lists for games where a
brutal obscure tail hurts the experience (currently Spelldown, `scripts/gen-spelldown.js`).
Board letter-sets are still discovered against ENABLE, but each board's shipped
answer list is intersected with this set so only common words appear as answers
(and in the prior-day reveal). Quantity-oriented games keep using ENABLE.

Source: https://github.com/first20hours/google-10000-english — the
`google-10000-english-no-swears.txt` file (the 10,000 most common English words
by frequency, from the Google Trillion Word Corpus, with profanity removed). One
word per line, lowercased. Regenerate with `npm run gen:spelldown`.

---

The original source of "unsorted.txt":

http://www.greenworm.net/notes/2011/05/02/words-friends-wordlist

---

More specifically:

http://www.greenworm.net/sites/default/files/gw-assets/enable1-wwf-v4.0-wordlist.txt

---

The additions:

http://www.greenworm.net/sites/default/files/gw-assets/enable1-wwf-v4.0-wordlist-additions.txt

---

The deletions (Exceptionally NSFW):

http://www.greenworm.net/sites/default/files/gw-assets/enable1-wwf-v4.0-wordlist-deletions.txt

---

If you enjoy code golf I suggest you join us here:

https://codegolf.stackexchange.com/
