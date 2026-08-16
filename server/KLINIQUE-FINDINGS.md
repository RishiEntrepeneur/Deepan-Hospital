# Klinique integration — what the login revealed

All of this was gathered **read-only** with the `drdeepan` login. Nothing was
created, changed or deleted. It records what an automated booking would have to
do, and why doing it blind is risky.

## The good news

- **The login works** and it **can create bookings.** `drdeepan` (physician
  door, `/doctors/sign_in`) lands on Klinique's "Customer Management" and has an
  "Appointment Booking" section.
- **Single tenant:** `customer_id = 2` is DEEPAN HOSPITAL. The login sees only
  Deepan's data.

## Where a booking is created

Klinique has no simple "new appointment" endpoint. Bookings go through
**`POST /visits/register_patient`** — the "Quick Registration" form, which
registers the patient **and** books the visit in one step. That matches a
website booking (name, phone, doctor, date), but it is a large form.

## What maps cleanly (read from the form)

| Booking value | Klinique field | Values |
| --- | --- | --- |
| — (fixed) | `customer_id` | `2` (Deepan Hospital) |
| — (fixed) | `patient[...][patient_type_id]` | `1` (GENERAL) |
| gender | `patient[gender]` | **1 = Female, 2 = Male** (inverted from intuition) |
| session | `patient[visits_attributes][0][schedule_name]` | `schedule1` Morning · `schedule2` Afternoon · `schedule3` Evening · `schedule4` Night |
| name | `patient[patient_details_attributes][0][first_name]` / `last_name` | free text |
| phone | `patient[patient_details_attributes][0][mobile_number]` | free text |
| date | `patient[visits_attributes][0][visit_date]` | date |
| time | `patient[visits_attributes][0][schedule_intime]` | time |
| department | `patient[visits_attributes][0][speciality_id]` | 9=General Medicine, 3=Paediatrics, 2=Cardiology, 8=Dermatology, 7=OB&G, 5=Orthopaedics, 18=Ophthalmology, … |

## What does NOT map cleanly — the risks

1. **The doctor is a fuzzy autocomplete, not a clean list.**
   `physician_id` is a type-ahead over a large directory of doctors — many more
   than Deepan's OP list, with near-duplicate names ("DR SRIDHARAN" appears more
   than once). Matching our roster to the right id by name is guesswork, and a
   wrong match **books the patient with the wrong doctor.** This is the single
   most dangerous part.

2. **SMS fires on submit.** The form carries `send_sms[op_app_confirmation]` and
   `send_sms[op_app_reminder]`. A submit with a wrong or test number **texts a
   real person.** Any automation must set these off unless we mean them.

3. **It registers a new patient every time.** A returning patient booking
   through this form may create a **duplicate patient record** unless Klinique
   dedupes by mobile — which is not visible from outside.

4. **Gender is inverted** (1=Female, 2=Male) — easy to get backwards, and wrong
   on a medical record.

## Why this argues for a human glance

Fully hands-off submission into this form means that a wrong doctor match, a
duplicate patient, or a mis-set gender is written to a live medical record with
nobody looking — and an SMS may go to the wrong number. The **one-click
extension** (reception opens the form, it fills, a person confirms and presses
Save) removes the typing but keeps the one glance that catches exactly these
four failures. Now that the form and its fields are known, the extension can be
pointed at it.

## Why fully-automatic was stopped

Two live test submissions were attempted (with test data, SMS off). **Neither
created anything** — the first hit the wrong URL (404), the second was rejected
by validation (200, form re-rendered). Nothing was written to Klinique.

They revealed why blind auto-submission is the wrong tool here:

1. **The submit endpoint is `/visits/create_patient_with_emergency_visit`.**
   The "Quick Registration" form posts there — an *emergency-visit* path. Using
   it for ordinary website bookings risks flagging every one as an emergency.
2. **The correct OP-appointment path (`/op_appointments`) is multi-step** —
   pick doctor + date, load available slots, then book a slot. Automating that
   blind means reverse-engineering an AJAX flow against a live patient system.
3. **Getting a valid POST needs trial and error on that live system** — each
   guess is a write attempt at a real patient-creation endpoint. That is not a
   safe thing to iterate on, whatever the result.

So the recommendation is the **one-click extension** (a human confirms a normal,
correct booking) or the **Klinique API**. The groundwork below feeds either.

## The doctor map (built read-only, needs a human's eye on the ? line)

```
KLINIQUE_DOCTOR_MAP={"gunasekaran-r":"1","deepan-g":"2","priyanka-v":"4","kawin-g":"3","vaishnavi-rm":"5","rajagopal-p":"8","venkateswaran-n":"6","krishnasamy-kannan":"13","narmadha-s":"9","deborah-roselin":"63","devika-sudhager":"65","sudhager-sundararajan-gks":"64","neethu":"55","nivedha-p":"57"}
```

- 14 of 15 bookable doctors matched. Dr. Deepan = physician `2`.
- **Dr. Hari Prasad** is not in Klinique's physician list — he would fall back
  to the manual worklist rather than be mis-booked.
- Re-run any time with `npm run klinique-doctors` (read-only).

## Reference values (read from the form)

- `customer_id = 2` (Deepan Hospital)
- gender: `1 = Female, 2 = Male`
- session: `schedule1..4` = Morning / Afternoon / Evening / Night
- speciality_id: 9=Gen Med, 3=Paeds, 2=Cardio, 5=Ortho, 7=OB&G, 8=Derm, 18=Ophthal, …
- dates `DD-MM-YYYY`, times `hh:mm AM/PM`
