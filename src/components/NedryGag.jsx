// Dennis Nedry "ah ah ah, you didn't say the magic word!" gag. Used inline on
// the site's "denied" states (empty search, 404s) — the GIF wags at you, the
// usual helpful line sits underneath. The GIF is self-hosted at /nedry-wag.gif
// (public/); if it ever goes missing the caption still carries the joke.
export default function NedryGag({ message }) {
  return (
    <div className="arcade-nedry">
      <img
        className="arcade-nedry-gif"
        src="/nedry-wag.gif"
        alt="A finger wags: ah ah ah!"
        width={220}
        height={187}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <p className="arcade-nedry-quote">Ah ah ah — you didn't say the magic word!</p>
      {message ? <p className="arcade-nedry-sub">{message}</p> : null}
    </div>
  );
}
