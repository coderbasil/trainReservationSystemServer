import express from "express";
import cors from "cors";
import * as db from "./database.js";
const app = express();
app.use(cors({ origin: "http://localhost:8000" }));
app.use(express.json());




app.get("/pop", async (req, res) => {
  db.clearSeats();
  const trains = await db.getTrains();
  for (const element of trains) {
    for (let index = 1; index < element.total_cabin_seats; index++) {
      await db.insertSeat(element.train_id, "Cabin");
    }
    for (let index = 1; index < element.total_firstclass_seats; index++) {
      await db.insertSeat(element.train_id, "First Class");
    }
  }
  res.status(200).json({});
});

app.get("/bookings/:id", async (req, res) => {
  res.status(200).json(await db.getBooking(req.params.id));
});

app.get("/dependents/:id", async (req, res) => {
  res.status(200).json(await db.getDependents(req.params.id));
});

app.get("/passenger/:id", async (req, res) => {
  res.status(200).json(await db.getPassenger(req.params.id));
});

app.get("/reports/:filters", async (req, res) => {
  res.status(200).json(await db.getReports(req.params.filters));
});

app.get("/dashboard/trains", async (req, res) => {
  res.status(200).json(await db.getTrains());
});
app.get("/dashboard/staff", async (req, res) => {
  res.status(200).json(await db.getStaff());
});

app.post("/assignStaffToTrain", async (req, res) => {
  const { trainId, driverId, engineerId } = req.body;
  await db.updateStaff(trainId, driverId, engineerId);
  res.status(200).json();
});
app.get("/train/:id", async (req, res) => {
  res.status(200).json(await db.getTrainSeats(req.params.id));
});
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.getUser(username, password);
  const pId = await db.getPassenger(user.user_id);
  if (user.role == "Passenger") {
    res.status(200).json({
      token: "1234567890abcdef",
      user: {
        name: username,
        role: user.role,
        userId: user.user_id,
        passengerId: pId.passenger_id,
      },
    });
    console.log("Login successful!");
  } else if (user.role == "Admin") {
    res.status(200).json({
      token: "1234567890abcdef",
      user: { name: username, role: user.role },
    });
    console.log("Login successful!");
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials!" });
    console.log("Invalid credentials!");
  }
});


app.post("/api/book-seat", async (req, res) => {
  try {
    const { trainId, occupantIds, seatClass, totalPrice } = req.body;
 

    const result = await db.BookSeat(trainId, occupantIds, seatClass, totalPrice);

    if (result.payed) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json({ success: false, message: result.message || "Not enough balance." });
    }

  } catch (error) {
    console.error("Error booking seat:", error);
    return res.status(500).json({ error: "Server error." });
  }
});


// app.post("/api/book-seat", async (req, res) => {
//   const { trainId, ids, seatClass, totalPrice } = req.body;
//   const { payed, reservationId, ticketId } = await db.BookSeat(
//     trainId,
//     ids,
//     seatClass,
//     totalPrice
//   );
//   if(payed){
//   res.status(200).json({
//     message: "Seat booked successfully!",
//     reservationId,
//     ticketId,
//   });} else {
//     res.status(422)
//   }
// });

app.get("/api/reservations", async (req, res) => {
  res.status(200).json(await db.getReservations());
});

app.put("/api/reservations/:id", async (req, res) => {
  const { status, seat_class } = req.body;
  console.log(status);
  await db.updateReservations(status, seat_class, req.params.id);
  res.status(200);
});

app.get("/alerts/:id", async (req, res) => {
  let p = await db.getPassenger(req.params.id);
  let id = p[0].passenger_id;
  let alerts = await db.allalerts(id);
  res.status(200).json(alerts);
});

app.listen(5000, () => {});
