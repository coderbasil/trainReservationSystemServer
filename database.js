import mysql from "mysql2";
import { json } from "express";

const pool = mysql
  .createPool({
    host: "127.0.0.1",
    user: "root",
    password: "root",
    database: "tdb",
  })
  .promise();

export async function getUser(username, password) {
  const [rows] = await pool.query(
    `
        SELECT * 
        FROM Users 
        WHERE username = ? AND password = ?`,
    [username, password]
  );
  if (rows.length != 1) {
    return 0;
  }
  return rows[0];
}

export async function updateStaff(tid, did, eid) {
  await pool.query(
    `
    UPDATE Trains
    SET driver_id = ?, engineer_id = ?
    WHERE train_id = ?
    `,
    [did, eid, tid]
  );
}

export async function clearSeats() {
  await pool.query(`DELETE FROM Seats`);
}
export async function getReservations() {
  const [rows] = await pool.query("SELECT * FROM Reservations");
  return rows;
}

export async function getStaff() {
  const [rows] = await pool.query("SELECT * FROM Staff");
  return rows;
}

export async function getDependents(id) {
  const [rows] = await pool.query(
    `SELECT * FROM Dependents
    WHERE passenger_id = ?`,
    [id]
  );
  return rows;
}

export async function insertSeat(id, s_class) {
  try {
    await pool.query(
      `
      INSERT INTO Seats (train_id, seat_status, seat_class)
      VALUES (?, "Free", ?)
      `,
      [id, s_class]
    );
  } catch (error) {
    console.error("Error inserting seat:", error.message);
  }
}

// export async function getPassenger(id) {
//   const [rows] = await pool.query(
//     `SELECT * FROM Passenger
//     WHERE passenger_id = ?`,
//     [id]
//   );
//   return rows;
// }

export async function updateReservations(params, seat_class, id) {
  if (params == "cancel") {
    await pool.query(
      `
            UPDATE Reservations
            SET status = 'Cancelled'
            Where reservation_id = ?
            `,
      [id]
    );
    await pool.query(
      `
            DELETE From Tickets
            Where reservation_id = ?
            `,
      [id]
    );
  } else if (params == "confirm") {
    await pool.query(
      `
            UPDATE Reservations
            SET status = 'Confirmed'
            Where reservation_id = ?
            `,
      [id]
    );

    const [train_id] = await pool.query(
      `
            SELECT train_id
            FROM Reservations
            WHERE reservation_id = ?
            `,
      [id]
    );

    const [seat_id] = await pool.query(
      `
      SELECT seat_id
      FROM Seats
      WHERE train_id = ? AND seat_status = "Free" AND seat_class = ?    
      `,
      [train_id[0].train_id, seat_class]
    );

    await pool.query(
      `
            INSERT INTO Tickets (reservation_id, seat_id, train_id)
            VALUES (?,?,?)
            `,
      [id, seat_id[0].seat_id, train_id[0].train_id]
    );
    console.log("hi");
  }
}

export async function getPassenger(id) {
  const [rows] = await pool.query(
    "SELECT * FROM Passengers WHERE user_id = ?",
    [id]
  );
  return rows;
}

export async function getTrains() {
  const [rows] = await pool.query("SELECT * FROM Trains");
  await pool.query(`
      UPDATE Trains T
      SET available_cabin_seats = (
          SELECT total_cabin_seats - COUNT(S.seat_id) 
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'Cabin'
      )
      WHERE EXISTS (
          SELECT 1
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'Cabin'
      );
    `);

  await pool.query(`
      UPDATE Trains T
      SET available_firstclass_seats = (
          SELECT total_firstclass_seats - COUNT(S.seat_id)
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'First Class'
      )
      WHERE EXISTS (
          SELECT 1
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'First Class'
      );
    `);
  return rows;
}

export async function getTrainSeats(id) {
  const [results] = await pool.query(
    `SELECT 
    T.train_id,
    T.train_name,
    T.total_seats,
    T.available_seats,
    T.departure_time,
    T.arrival_time,
    S.seat_id,
    S.seat_status,
    S.seat_class
FROM 
    Trains T
LEFT JOIN 
    Seats S ON T.train_id = S.train_id
WHERE 
    T.train_id = ?;
`,
    [id]
  );
  const trainDetails = {
    train: {
      train_id: results[0]?.train_id,
      train_name: results[0]?.train_name,
      total_seats: results[0]?.total_seats,
      available_seats: results[0]?.available_seats,
      departure_time: results[0]?.departure_time,
      arrival_time: results[0]?.arrival_time,
    },
    seats: results.map((row) => ({
      seat_id: row.seat_id,
      seat_status: row.seat_status,
      seat_class: row.seat_class,
    })),
  };
  return trainDetails;
}

export async function getBooking(id) {
  const [rows] = await pool.query(
    `SELECT * 
        FROM ReservationTrainView 
        WHERE reservation_id IN (SELECT reservation_id FROM Reservations WHERE passenger_id = (
        SELECT passenger_id FROM Passengers WHERE user_id = ?
        ))`,
    [id]
  );
  return rows;
}

export async function getReports(filter) {
  const filters = filter.split("+");
  if (filters[0] == "active_trains_today") {
    const [active_trains_today] = await pool.query(
      `SELECT * 
        FROM TRAINS 
        WHERE DATE(departure_time) = ?`,
      [filters[1]]
    );
    return active_trains_today;
  }

  if (filters[0] == "stations_for_each_train") {
    const [stations_for_each_train] = await pool.query(
      `SELECT train_id, station_id
            FROM TrainStations`
    );
    return stations_for_each_train;
  }

  if (filters[0] == "reservation_by_passengerId") {
    const [reservation_by_passengerId] = await pool.query(
      `SELECT *
            FROM Reservations
            WHERE passenger_id = ?`,
      [filters[1]]
    );
    return reservation_by_passengerId;
  }

  if (filters[0] == "waitlisted_loyalty") {
    const [waitlisted_loyalty] = await pool.query(
      `SELECT R.train_id, P.loyalty_status,
        COUNT(R.reservation_id) AS waitlisted_passengers
        FROM Reservations R
        JOIN Passengers P ON R.passenger_id = P.passenger_id
        WHERE R.status = 'Waitlisted'
        AND R.train_id = ?
        GROUP BY R.train_id, P.loyalty_status`,
      [filters[1]]
    );
    return waitlisted_loyalty;
  }

  if (filters[0] == "average_load_factor") {
    var date = new Date(filters[1])
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const [average_load_factor] = await pool.query(
      `
    SELECT 
        T.train_id, 
        T.train_name,
        DATE(T.departure_time) AS travel_date,
        ROUND(
            SUM(
                CASE 
                    WHEN R.status = 'Confirmed' THEN 1 
                    ELSE 0 
                END
            ) * 100.0 / (
                T.total_cabin_seats + T.total_firstclass_seats
            ), 2
        ) AS load_factor_percentage
    FROM 
        Trains T
    LEFT JOIN 
        Reservations R ON T.train_id = R.train_id
    WHERE 
        DATE(T.departure_time) = ?
    GROUP BY 
        T.train_id, T.train_name, travel_date;
    `,
      [date]
    );
    return average_load_factor;
  }

  if (filters[0] == "dependents_list") {
    var date = new Date(filters[1])
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const [dependents_list] = await pool.query(
      `SELECT 
            D.dependent_id,
            D.name AS dependent_name,
            P.passenger_id,
            T.train_id,
            T.train_name,
            DATE(T.departure_time) AS travel_date
        FROM 
            Dependents D
        JOIN 
            Passengers P ON D.passenger_id = P.passenger_id
        JOIN 
            Reservations R ON P.passenger_id = R.passenger_id
        JOIN 
            Trains T ON R.train_id = T.train_id
        WHERE 
            DATE(T.departure_time) = ?
        `,
      [date]
    );
    return dependents_list;
  }
}

export async function BookSeat(trainId, price, user, payed) {
  let userId = user;
  price = parseInt(price);

  let dependentId;
  let passengerId;
  let loyalty_status;

  if (userId.charAt(0) == "D") {
    dependentId = userId;
    passengerId = null;
  } else {
    dependentId = null;
    passengerId = userId;
    loyalty_status = await pool.query(
      `
      SELECT loyalty_status 
      FROM Passengers
      WHERE passenger_id = ?
      `,
      [passengerId]
    );
  }

  let c;

  if (price <= 50) {
    c = "Cabin";
  } else {
    c = "First Class";
  }

  const [seatRows] = await pool.query(
    `SELECT seat_id FROM Seats WHERE train_id = ? AND seat_status = "Free" AND seat_class = ?`,
    [trainId, c]
  );
  if (seatRows.length === 0) {
    throw new Error("Seat not found.");
  }

  let status = "Confirmed";

  if (payed != price) {
    status = "Waitlisted";
  }

  const [reservationResult] = await pool.query(
    `INSERT INTO Reservations (passenger_id, dependent_id, train_id, status, reservation_date)
          VALUES (?, ?, ?, ?, NOW())`,
    [passengerId || null, dependentId || null, trainId, status]
  );

  const reservationId = reservationResult.insertId;

  const [ticketResult] = await pool.query(
    `INSERT INTO Tickets (reservation_id, seat_id, train_id)
          VALUES (?, ?, ?)`,
    [reservationId, seatRows[0].seat_id, trainId]
  );

  const ticketId = ticketResult.insertId;

  await pool.query(
    `UPDATE Seats
          SET seat_status = 'Booked', ticket_id = ?
          WHERE seat_id = ? AND train_id = ?`,
    [ticketId, seatRows[0].seat_id, trainId]
  );

  if (price == payed) {
    await pool.query(
      `INSERT INTO Payments (reservation_id, payment_date, amount)
          VALUES (?, NOW(), ?)`,
      [reservationId, price]
    );
  }

  await pool.query(`
      UPDATE Trains T
      SET available_cabin_seats = (
          SELECT total_cabin_seats - COUNT(S.seat_id)
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'Cabin'
      )
      WHERE EXISTS (
          SELECT 1
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'Cabin'
      );
    `);

  await pool.query(`
      UPDATE Trains T
      SET available_firstclass_seats = (
          SELECT total_firstclass_seats - COUNT(S.seat_id)
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'First Class'
      )
      WHERE EXISTS (
          SELECT 1
          FROM Seats S
          WHERE S.train_id = T.train_id AND S.seat_status = 'Booked' AND S.seat_class = 'First Class'
      );
    `);

  return { reservationId, ticketId };
}

export async function reservation_alert(id) {
  const [rows] = await pool.query(
    `
    SELECT 
        R.reservation_id,
        T.train_id,
        T.departure_time
    FROM 
        Reservations R
    JOIN 
        Trains T ON R.train_id = T.train_id
    WHERE 
        R.passenger_id = ?`,
    [id]
  );

  let x = false;

  rows.forEach((element) => {
    const now = new Date();
    const departureDate = new Date(element.departure_time);

    const timeDifference = (departureDate - now) / (1000 * 60 * 60); 

    if (timeDifference < 3 && timeDifference > 0) {
      x= true;
    }
  });
  return x;
}

export async function waitlist_email(id) {
  const [rows] = await pool.query(`
    SELECT 
    U.email, 
    U.username, 
    R.reservation_id, 
    R.status
FROM 
    Reservations R
JOIN 
    Passengers P ON R.passenger_id = P.passenger_id
JOIN 
    Users U ON P.user_id = U.user_id
WHERE 
    R.status = 'Waitlisted'
    AND
    P.passenger_id = ? 
  `,[id]);

  if (rows.length>0) {
    return 1;
  }
  else return 0;
}


export async function allalerts(id) {
  let alerts = [];

  if (await reservation_alert(id) == 1) {
    alerts.push("YOU HAVE A TRIP IN LESS THAN 3 HOURS");
  }
  if (await waitlist_email(id) == 1) {
    alerts.push("YOU HAVE AN UNPAID RESERVATION");
  }
  return alerts
}