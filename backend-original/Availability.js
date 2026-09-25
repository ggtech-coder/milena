const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
  admin,
  timeToMinutes,
  minutesToTime,
  intervalsOverlap,
  BLOCKING_STATUSES,
} = require("./helpers");

const db = admin.firestore();

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SLOT_STEP_MINUTES = 15; // granularidade dos horários oferecidos

/**
 * getAvailability({ date, serviceId })
 * Retorna apenas os horários de INÍCIO possíveis (array de "HH:MM"),
 * já considerando: horário de funcionamento do dia, agendamentos existentes
 * (PENDING_PAYMENT não expirado + CONFIRMED) e bloqueios manuais.
 * NÃO expõe nenhum dado de cliente — só a lista de horários livres.
 */
exports.getAvailability = onCall(
  { region: "southamerica-east1", cors: true },
  async (request) => {
    const { date, serviceId } = request.data || {};
    if (!date || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpsError("invalid-argument", "date (YYYY-MM-DD) e serviceId são obrigatórios.");
    }

    const serviceSnap = await db.collection("services").doc(serviceId).get();
    if (!serviceSnap.exists || serviceSnap.data().active === false) {
      throw new HttpsError("not-found", "Serviço não encontrado ou inativo.");
    }
    const duration = serviceSnap.data().durationMinutes;

    const settingsSnap = await db.collection("businessSettings").doc("weeklyHours").get();
    const weeklyHours = settingsSnap.exists ? settingsSnap.data() : {};

    const [y, m, d] = date.split("-").map(Number);
    const jsDate = new Date(Date.UTC(y, m - 1, d, 12)); // meio-dia UTC evita erro de fuso na semana
    const weekday = WEEKDAYS[jsDate.getUTCDay()];
    const dayConfig = weeklyHours[weekday];

    if (!dayConfig || !dayConfig.open) {
      return { slots: [] }; // dia fechado
    }

    const dayStart = timeToMinutes(dayConfig.start);
    const dayEnd = timeToMinutes(dayConfig.end);

    // Não oferece horário que já passou, se a data for hoje (fuso America/Sao_Paulo, UTC-3)
    const nowSp = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const todaySp = nowSp.toISOString().slice(0, 10);
    const nowMinutesSp = nowSp.getUTCHours() * 60 + nowSp.getUTCMinutes();
    const isToday = date === todaySp;

    const [apptSnap, blockedSnap] = await Promise.all([
      db.collection("appointments").where("date", "==", date).get(),
      db.collection("blockedPeriods").where("date", "==", date).get(),
    ]);

    const nowMs = Date.now();
    const busyIntervals = [];

    apptSnap.docs.forEach((doc) => {
      const appt = doc.data();
      if (!BLOCKING_STATUSES.includes(appt.status)) return;
      if (appt.status === "PENDING_PAYMENT") {
        const expiresAtMs = appt.expiresAt ? appt.expiresAt.toMillis() : 0;
        if (expiresAtMs <= nowMs) return;
      }
      const start = timeToMinutes(appt.startTime);
      busyIntervals.push([start, start + appt.durationMinutes]);
    });

    blockedSnap.docs.forEach((doc) => {
      const b = doc.data();
      if (b.fullDay) {
        busyIntervals.push([0, 24 * 60]);
      } else {
        busyIntervals.push([timeToMinutes(b.startTime), timeToMinutes(b.endTime)]);
      }
    });

    const slots = [];
    for (let start = dayStart; start + duration <= dayEnd; start += SLOT_STEP_MINUTES) {
      if (isToday && start <= nowMinutesSp) continue;
      const end = start + duration;
      const conflict = busyIntervals.some(([bStart, bEnd]) => intervalsOverlap(start, end, bStart, bEnd));
      if (!conflict) slots.push(minutesToTime(start));
    }

    return { slots };
  }
);