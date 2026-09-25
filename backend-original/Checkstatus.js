const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin } = require("./helpers");

const db = admin.firestore();

/**
 * checkAppointmentStatus({ appointmentId })
 * Retorna só { status } — usado pela tela de pagamento para saber quando o
 * webhook confirmou o pagamento, sem expor dados de outras clientes nem
 * exigir leitura direta da coleção appointments pelo client (que é bloqueada
 * nas security rules).
 */
exports.checkAppointmentStatus = onCall(
  { region: "southamerica-east1", cors: true },
  async (request) => {
    const { appointmentId } = request.data || {};
    if (!appointmentId) throw new HttpsError("invalid-argument", "appointmentId obrigatório.");
    const snap = await db.collection("appointments").doc(appointmentId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Agendamento não encontrado.");
    return { status: snap.data().status };
  }
);