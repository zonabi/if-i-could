# If I Could Tell You, I Would

A proof-of-concept for an app built on the composition exercise Roger Dickerson taught Terence Blanchard, and that Blanchard now teaches in his own workshops.

Students get one sentence, "If I could tell you, I would", and one instruction: write two new sentences using only those words.  Most first answers shuffle all seven words.  The lesson lands when they see what else was allowed.

## The flow

1. **First round.**  The sentence, one instruction, two blank lines.  Free typing, so repeats, short answers and punctuation are all accepted and none is suggested.
2. **The room.**  The student's two sentences appear among everyone else's.
3. **The reveal.**  Three sentences nobody wrote, one at a time, with sound.  Each word is a pitch and each punctuation mark changes how it is played.
4. **The mirror.**  The moves those three used, set against what the student did.
5. **Free play.**  A word-tile builder with sound and a move tracker, then a motif lab that applies the same moves to notes (step, reverse, mirror, key change).

## Look

"Midnight Brass": deep indigo, a brass accent, tall condensed capitals (Anton) over DM Sans.  The screen flips from indigo to brass for the reveal.  Colours are the custom properties at the top of `styles.css`.

## What is simulated

- **The room is canned.**  Classmates' answers come from `Room.others()` in `app.js`.  A live room needs a small shared backend (room code plus a realtime list, for example Supabase or Firebase) behind that same object.
- **Pitch and sound mappings are placeholders.**  Which word gets which note, and how each mark sounds, are design guesses to be set with Terence.

## Run it

No build step.  Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Deploy on GitHub Pages

1. Push to GitHub.
2. In the repository, open Settings, then Pages.
3. Under Build and deployment, choose Deploy from a branch, branch `main`, folder `/ (root)`.
4. The site appears at `https://<user>.github.io/<repo>/` after a minute or two.

## Files

- `index.html` — markup for all five stages
- `styles.css` — styles
- `app.js` — parsing, move detection, audio, the room, the motif lab
- `docs/research.md` — background on the technique, with sources
