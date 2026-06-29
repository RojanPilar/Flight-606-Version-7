const express = require("express");
const bookingPassengerController = require("../controllers/bookingPassenger");
const { verify, verifyAdmin } = require("../auth");
const router = express.Router();

// USER LEVEL ACCESS
router.post("/user/create", verify, bookingPassengerController.createBookingPassenger);
router.post("/guest/create", bookingPassengerController.createBookingPassengerGuest);
router.get("/get-by-booking/:bookingId", bookingPassengerController.getBookingPassengerByBooking);

// ADMIN LEVEL ACCESS
router.get("/get-all", verify, verifyAdmin, bookingPassengerController.getAllBookingPassengers);
router.patch("/deactivate-booking-passenger/:id", verify, verifyAdmin, bookingPassengerController.deactivateBookingPassenger);
router.patch("/reactivate-booking-passenger/:id", verify, verifyAdmin, bookingPassengerController.reactivateBookingPassenger);

module.exports = router;