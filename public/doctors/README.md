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
Ask each doctor before publishing their photograph.
