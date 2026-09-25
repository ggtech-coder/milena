const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./helpers");

const db = admin.firestore();

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login necessário.");
  }
  // Qualquer usuário autenticado no Firebase Auth deste projeto é a
  // administradora (é single-tenant, só existe 1 conta admin).
}

exports.cancelAppointment = onCall(
  { region: "southamerica-east1", cors: true },
  async (request) => {
    assertAdmin(request);
    const { appointmentId, reason } = request.data || {};
    if (!appointmentId) throw new HttpsError("invalid-argument", "appointmentId obrigatório.");

    const ref = db.collection("appointments").doc(appointmentId);
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Agendamento não encontrado.");
      t.update(ref, {
        status: "CANCELLED",
        cancelReason: reason || null,
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        // Estrutura preparada para reembolso futuro via gateway:
        refundStatus: snap.data().paymentStatus === "PAID" ? "PENDING_MANUAL_REFUND" : "NOT_APPLICABLE",
      });
    });
    return { ok: true };
  }
);

exports.blockPeriod = onCall(
  { region: "southamerica-east1", cors: true },
  async (request) => {
    assertAdmin(request);
    const { date, startTime, endTime, fullDay, reason } = request.data || {};
    if (!date) throw new HttpsError("invalid-argument", "date obrigatório.");
    if (!fullDay && (!startTime || !endTime)) {
      throw new HttpsError("invalid-argument", "startTime/endTime obrigatórios quando não for dia inteiro.");
    }
    const ref = db.collection("blockedPeriods").doc();
    await ref.set({
      date,
      startTime: fullDay ? null : startTime,
      endTime: fullDay ? null : endTime,
      fullDay: !!fullDay,
      reason: reason || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  }
);

exports.unblockPeriod = onCall(
  { region: "southamerica-east1", cors: true },
  async (request) => {
    assertAdmin(request);
    const { blockId } = request.data || {};
    if (!blockId) throw new HttpsError("invalid-argument", "blockId obrigatório.");
    await db.collection("blockedPeriods").doc(blockId).delete();
    return { ok: true };
  }
);