# Doctor portraits

Drop a photograph here named after the doctor's id, as `<id>.jpg`.
The card shows their initials until the file exists — nothing breaks either way.

Ids come straight from the roster:

    gunasekaran-r.jpg      Dr. R. Gunasekaran
    deepan-g.jpg           Dr. G. Deepan
    priyanka-v.jpg         Dr. V. Priyanka
    kawin-g.jpg            Dr. G. Kawin
    ...

Get the full list with:

    curl -s localhost:4000/api/catalog | node -pe "JSON.parse(require('fs').readFileSync(0)).doctors.map(d=>d.id+'.jpg  '+d.name.en).join('\n')"

Square images, around 400×400, look best — they are shown in a circle.

Check what you have dropped in:

    npm run photos

It lists who still needs one and — the part you cannot see from the site —
any file whose name matches no doctor. A misspelt filename shows the doctor's
initials instead, which looks exactly like "no photo supplied yet".

## Where the photographs must come from

The hospital, with each doctor's agreement. Not from another hospital's site,
a listing site or a search result:

- the copyright belongs to whoever took the picture, not to this hospital;
- a photograph of a named person is their personal data under the DPDP Act,
  and their likeness besides — so ask, and keep a note of who agreed;
- matching a stranger's face to a name by guesswork is the real danger. This
  roster has several common Tamil names, and directories carry many doctors
  who share them. The wrong face beside a consultant's name is worse than no
  face at all, which is why the card is designed to look finished without one.
