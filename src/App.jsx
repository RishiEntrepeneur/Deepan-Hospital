import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useLanguage } from "./i18n/context";
import { useCatalog } from "./lib/useCatalog";
import { useAppointments } from "./lib/useAppointments";
import { useAuth } from "./lib/useAuth";
import { api, errorKeyFor } from "./lib/api";
import { payForAppointment } from "./lib/razorpay";
import Header from "./components/Header";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import AppSkeleton from "./components/AppSkeleton";
import { cx } from "./lib/cx";
import Toast from "./components/Toast";

import Home from "./pages/Home";
import Doctors from "./pages/Doctors";
import Services from "./pages/Services";
import Appointments from "./pages/Appointments";
import Contact from "./pages/Contact";
import Account from "./pages/Account";

/*
 * Split out of the first download.
 *
 * The desk is staff-only, the glossary is 70+ definitions, health and privacy
 * are read once. None of them is needed by a patient landing on the home page
 * to book an appointment — which is the journey that has to be fast on a
 * cheap phone over patchy mobile data.
 */
const Glossary = lazy(() => import("./pages/Glossary"));
/*
 * None of these is on screen when the page first paints. The booking modal
 * opens on a click, the assistant on a click, the tour a second later — so
 * none of them needs to be in the download that decides how fast the home
 * page appears on a slow connection.
 */
const BookingModal = lazy(() => import("./components/booking/BookingModal"));
const Assistant = lazy(() => import("./components/Assistant"));
const Tour = lazy(() => import("./components/Tour"));
const Desk = lazy(() => import("./pages/Desk"));
const Health = lazy(() => import("./pages/Health"));
const Privacy = lazy(() => import("./pages/Privacy"));
const DoctorProfile = lazy(() => import("./pages/DoctorProfile"));
const ConsentPrompt = lazy(() => import("./components/ConsentPrompt"));
const Opening = lazy(() => import("./components/Opening"));

import { patientTour } from "./lib/tours";
import { parseRoute } from "./lib/navigation";

/** Holds the layout steady while a split route arrives. */
function PageLoading() {
  return (
    <div className="grid place-items-center py-24">
      <LoaderCircle
        className="size-6 animate-spin text-brand-600"
        aria-hidden="true"
      />
    </div>
  );
}



export default function App() {
  const { t } = useLanguage();
  const catalog = useCatalog();
  const auth = useAuth();
  const appointments = useAppointments(auth.isSignedIn);

  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const page = route.page;
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [toast, setToast] = useState("");
  const [booking, setBooking] = useState(null);
  const [staff, setStaff] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [consentDismissed, setConsentDismissed] = useState(false)
  const showConsent = auth.consentNeeded && !consentDismissed && page !== 'desk';

  /*
   * The opening screen, on a first visit only.
   *
   * Read synchronously in the initial state rather than set by an effect: a
   * frame of the home page appearing and then being covered by a full-screen
   * panel is worse than either on its own. The desk is exempt — staff open this
   * app twenty times a day and are not choosing a language each time.
   */
  const [openingOpen, setOpeningOpen] = useState(() => {
    if (window.location.hash.includes("desk")) return false;
    try {
      return !localStorage.getItem("deepan_opening_seen");
    } catch {
      /* private mode: show it, and it simply offers again next time */
      return true;
    }
  });

  const closeOpening = useCallback(() => {
    setOpeningOpen(false);
    try {
      localStorage.setItem("deepan_opening_seen", "1");
    } catch {
      /* private mode — nothing to remember it with */
    }
  }, []);

  /*
   * Offer the tour once, and only after the catalogue has loaded so the tour
   * never highlights a skeleton. Declining is remembered — nobody should be
   * shown the same walkthrough twice.
   *
   * It waits for the opening screen to be gone. Two overlays at once is one
   * too many, and the tour points at controls the opening screen covers.
   */
  useEffect(() => {
    if (openingOpen) return undefined;
    try {
      if (localStorage.getItem("deepan_tour_seen")) return undefined;
    } catch {
      return undefined;
    }
    const timer = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(timer);
  }, [openingOpen]);

  /*
   * Built once per language, not once per render.
   *
   * Passing a freshly built array made every step object new on each render,
   * which restarted the tour's positioning effect — re-navigating and firing
   * another smooth scroll each time. That was the tour's lag.
   */
  const tourSteps = useMemo(() => patientTour(t), [t]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    try {
      localStorage.setItem("deepan_tour_seen", "1");
    } catch {
      /* private mode — it will simply offer again next time */
    }
  }, []);

  /* Staff and patient sessions live in separate cookies and coexist. */
  useEffect(() => {
    const controller = new AbortController();
    api.desk
      .me(controller.signal)
      .then((d) => setStaff(d.staff))
      // An abort is not a signed-out answer — see the note in useAuth. Clearing
      // here logged a doctor out of the desk in the interface while their
      // session was still perfectly valid.
      .catch((error) => {
        if (error?.name !== "AbortError") setStaff(null);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next, param = "") => {
    const target = param ? `${next}/${encodeURIComponent(param)}` : next;
    setRoute({ page: next, param });
    window.location.hash = next === "home" ? "" : target;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openBooking = useCallback((options = {}) => {
    setBooking({
      departmentId: "",
      doctorId: "",
      rescheduleOf: null,
      ...options,
    });
  }, []);

  const closeBooking = useCallback(() => setBooking(null), []);
  const dismissToast = useCallback(() => setToast(""), []);

  const book = useCallback(
    async (payload, options) => {
      const appointment = await appointments.book(payload, options);
      setToast(
        t(
          appointment.status === "pending"
            ? "appt.heldToast"
            : "appt.bookedToast",
        ),
      );
      return appointment;
    },
    [appointments, t],
  );

  const requestCallback = useCallback(
    async (payload) => {
      const appointment = await appointments.requestCallback(payload);
      setToast(t("appt.requestedToast"));
      return appointment;
    },
    [appointments, t],
  );

  const reschedule = useCallback(
    async (id, payload) => {
      const appointment = await appointments.reschedule(id, payload);
      setToast(t("appt.rescheduledToast"));
      return appointment;
    },
    [appointments, t],
  );

  const payCounter = useCallback(
    async (id) => {
      const appointment = await appointments.payAtCounter(id);
      setToast(t("pay.counterRecorded"));
      return appointment;
    },
    [appointments, t],
  );

  const cancel = useCallback(
    async (appointment) => {
      try {
        await appointments.cancel(appointment.id);
        setToast(t("appt.cancelledToast"));
      } catch (error) {
        setToast(t(errorKeyFor(error)));
      }
    },
    [appointments, t],
  );

  /** "Pay now" from the appointments list. */
  const payNow = useCallback(
    async (appointment) => {
      try {
        const paid = await payForAppointment(appointment, {
          name: appointment.patient.name,
          phone: appointment.patient.phone,
          email: auth.user?.email,
          description: appointment.id,
        });
        if (paid) {
          appointments.upsert(paid);
          setToast(t("pay.settled"));
        }
      } catch (error) {
        setToast(t(errorKeyFor(error)));
      }
    },
    [appointments, auth.user, t],
  );

  const showDepartment = useCallback(
    (departmentId) => {
      setDepartmentFilter(departmentId);
      navigate("doctors");
    },
    [navigate],
  );

  const bookDoctor = useCallback(
    (doctor) =>
      openBooking({ departmentId: doctor.departmentId, doctorId: doctor.id }),
    [openBooking],
  );

  /* ---------------- Catalogue gates the whole app ---------------- */
  if (catalog.status === "loading") {
    return <AppSkeleton label={t("common.loading")} />;
  }

  if (catalog.status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-white px-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-rose-50 text-rose-600">
            <TriangleAlert className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-slate-900">
            {t("error.offlineTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("error.offlineText")}
          </p>
          <button
            type="button"
            onClick={catalog.reload}
            className="mt-5 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {t("error.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    /*
     * The trailing padding is the height of the phone's bottom nav bar. Without
     * it the bar floats over the last rows of the footer, which is where the
     * address and the emergency number live.
     */
    <div
      className={cx(
        "flex min-h-dvh flex-col bg-white",
        page !== "desk" && "pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0",
      )}
    >
      {/*
        * The desk is a staff workspace, not a page of the public site. It gets
        * a stripped header — no patient navigation, no Book button — and no
        * footer at all. Wrapping an operations screen in the patient site's
        * furniture invited a receptionist to click "Book an appointment" and
        * land in the patient booking flow instead of "Book for a caller".
        */}
      <Header
        deskMode={page === "desk"}
        page={page}
        onNavigate={navigate}
        onBook={() => openBooking()}
        appointmentCount={appointments.upcoming.length}
        user={auth.user}
        staff={staff}
        onStaffSignOut={async () => {
          await api.desk.signOut();
          setStaff(null);
          navigate("home");
        }}
        onSignOut={async () => {
          await auth.signOut()
          setToast(t('account.signedOut'))
          navigate('home')
        }}
      />

      {/*
        * Keyed on the page so React remounts on every navigation and the
        * arrival animation actually replays — without the key it runs once,
        * on first paint, and never again.
        */}
      <main key={page} className="animate-page-in flex-1">
        {page === "home" && (
          <Home
            onNavigate={navigate}
            onBook={() => openBooking()}
            onBookDoctor={bookDoctor}
            onSelectDepartment={showDepartment}
          />
        )}

        {page === "doctors" && (
          <Doctors
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            onBookDoctor={bookDoctor}
            onOpenDoctor={(doctor) => navigate("doctor", doctor.id)}
          />
        )}

        {page === "services" && (
          <Services onSelectDepartment={showDepartment} />
        )}

        {page === "appointments" && (
          <Appointments
            signedIn={auth.isSignedIn}
            loading={appointments.status === "loading"}
            upcoming={appointments.upcoming}
            past={appointments.past}
            onCancel={cancel}
            onReschedule={(appointment) =>
              openBooking({ rescheduleOf: appointment })
            }
            onBook={() => openBooking()}
            onPay={payNow}
            onSignIn={() => navigate("account")}
          />
        )}

        {page === "health" && (
          <Suspense fallback={<PageLoading />}>
            <Health
              signedIn={auth.isSignedIn}
              onSignIn={() => navigate("account")}
            />
          </Suspense>
        )}

        <Suspense fallback={<PageLoading />}>
          {page === "glossary" && (
            <Glossary onStartTour={() => setTourOpen(true)} />
          )}
          {page === "doctor" && (
            <DoctorProfile
              doctorId={route.param}
              onBook={(doctor) =>
                openBooking({ departmentId: doctor.departmentId, doctorId: doctor.id })
              }
              onNavigate={navigate}
            />
          )}
          {page === "privacy" && (
            <Privacy
              currentUser={auth.user}
              onSignedOut={() => {
                auth.refresh?.();
                navigate("home");
              }}
            />
          )}
        </Suspense>

        {page === "desk" && (
          <Suspense fallback={<PageLoading />}>
            <Desk onSignedOut={() => navigate('home')} onNavigate={navigate} />
          </Suspense>
        )}

        {page === "contact" && <Contact />}

        {page === "account" && (
          <Account
            auth={auth}
            upcomingCount={appointments.upcoming.length}
            onNavigate={navigate}
            onBook={() => openBooking()}
          />
        )}
      </main>

      {page !== "desk" && <Footer onNavigate={navigate} />}

      {/* Phones and tablets only; the desk has a real nav and different work. */}
      {page !== "desk" && (
        <BottomNav
          page={page}
          onNavigate={navigate}
          onBook={() => openBooking()}
          appointmentCount={appointments.upcoming.length}
        />
      )}

      {booking && (
        <Suspense fallback={null}>
          <BookingModal
            open
            onClose={closeBooking}
            onBook={book}
            onRequestCallback={requestCallback}
            onReschedule={reschedule}
            onPayCounter={payCounter}
            onPaid={(a) => appointments.upsert(a)}
            initialDepartmentId={booking.departmentId ?? ""}
            initialDoctorId={booking.doctorId ?? ""}
            rescheduleOf={booking.rescheduleOf ?? null}
            currentUser={auth.user}
            payments={catalog.payments}
            booking={catalog.booking}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <Assistant
          onNavigate={navigate}
          onBook={(options) => openBooking(options ?? {})}
          onDepartment={showDepartment}
          // The consent card sits in the same corner; the assistant's launcher
          // would cover its buttons.
          hidden={Boolean(booking) || page === "desk" || showConsent}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ConsentPrompt
          open={showConsent}
          onAgree={auth.giveConsent}
          onDismiss={() => setConsentDismissed(true)}
          onRead={() => navigate("privacy")}
        />
      </Suspense>

      <Suspense fallback={null}>
        <Tour
          steps={tourSteps}
          open={tourOpen && page !== "desk"}
          onClose={closeTour}
          onNavigate={navigate}
        />
      </Suspense>

      <Toast message={toast} onDismiss={dismissToast} />

      {/* Last, so it covers everything, and lazy so it costs nothing on the
          visits — almost all of them — where it never appears. */}
      {openingOpen && (
        <Suspense fallback={null}>
          <Opening
            onEnter={closeOpening}
            onBook={() => {
              closeOpening();
              openBooking();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
