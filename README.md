# Trig Facts Practice

**Live at [turksmathstuff.com/trigfacts](https://turksmathstuff.com/trigfacts/)**

A practice page for memorizing exact unit-circle trig facts in radians:

- **Unit Circle:** a line crosses the circle; name it as sin θ = … or cos θ = …
- **Trig Values:** sin, cos, and tan of the famous angles
- **Inverse Trig:** sin⁻¹, cos⁻¹, tan⁻¹, graded by principal value
- **Mixed Practice:** a balanced mix of everything

Answers are picked with a decoder-ring dial or buttons, so there's no typing. Rounds are 10 questions or endless, and progress is saved in the browser (no accounts).

## Working on it

- The page is plain HTML, CSS, and JavaScript modules in `trigfacts/`, with no build step.
- Preview locally: run `python3 -m http.server` in this folder and open `localhost:8000/trigfacts/`.
- Tests: `cd trigfacts && node --test _tests/*.test.js`
- Every push to `main` runs the tests and publishes `trigfacts/` (without the tests) through GitHub Pages.
