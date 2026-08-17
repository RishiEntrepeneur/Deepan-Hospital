# Retaking the screenshots

The status page shows three pictures of the reception desk. They are not kept in
this repository: they are a screen mid-task, they go stale the moment the desk
changes, and one of them contains a booking. Retake them when the page needs
updating.

Put them in `docs/klinique-status/shots/` (gitignored) under these names:

| File | What it shows |
| --- | --- |
| `desk-01.png` | The desk on the **Today** tab, so the tab row is visible |
| `desk-02-worklist.png` | The **To enter in Klinique** tab with at least one booking |
| `desk-03-portal.png` | The **Klinique** tab, showing the embedded portal |

Then:

```bash
node docs/klinique-status/build.mjs     # → demo-dist/klinique-status.html
```

## Getting a booking onto the worklist

The middle screenshot needs a real booking, so make one and delete it after.

```bash
# 1. Start the server, and find a free slot for a bookable doctor
cd server && npm start
curl -s "localhost:4000/api/doctors/deepan-g/availability?date=2026-08-19"

# 2. Book it as a guest — this is the same call the patient site makes
curl -s -X POST localhost:4000/api/appointments/guest \
  -H 'Content-Type: application/json' \
  -d '{"doctorId":"deepan-g","date":"2026-08-19","slot":"10:00","visitType":"first",
       "patient":{"name":"Preview Patient","age":42,"phone":"9876543210",
                  "gender":"male","reason":"Knee pain for two weeks"}}'
```

It lands on the worklist with `klinique.status = "pending"`.

**Delete it when you are done.** It is a patient record in shape even if the
name is invented, and it should not sit in the database or in a screenshot any
longer than it takes to photograph. `notifications` references the appointment,
so clear that first or the delete fails on a foreign key:

```sql
DELETE FROM notifications WHERE appointment_id = 'DH-XXXXXX';
DELETE FROM appointments  WHERE id = 'DH-XXXXXX';
```

## Use real data with care

If you retake these against the live hospital database rather than a seeded one,
every booking on screen is a real patient's name, phone number and reason for
visiting. Book a throwaway one as above instead, or blur the card. A published
page is not somewhere a patient's details can be withdrawn from.
