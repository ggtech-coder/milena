const admin = require("firebase-admin");
admin.initializeApp();

const { createBooking } = require("./src/createBooking");
const { mercadoPagoWebhook } = require("./src/webhook");
const { expireStaleBookings } = require("./src/cleanup");
const { cancelAppointment, blockPeriod, unblockPeriod } = require("./src/adminActions");
const { getAvailability } = require("./src/availability");
const { checkAppointmentStatus } = require("./src/checkStatus");

exports.createBooking = createBooking;
exports.mercadoPagoWebhook = mercadoPagoWebhook;
exports.expireStaleBookings = expireStaleBookings;
exports.cancelAppointment = cancelAppointment;
exports.blockPeriod = blockPeriod;
exports.unblockPeriod = unblockPeriod;
exports.getAvailability = getAvailability;
exports.checkAppointmentStatus = checkAppointmentStatus;