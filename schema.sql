DROP DATABASE IF EXISTS tdb;
CREATE DATABASE tdb;
USE tdb;

CREATE TABLE Users (
    user_id VARCHAR(10) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('Passenger', 'Staff', 'Admin') NOT NULL,
    email VARCHAR(100)
);


CREATE TABLE Passengers (
    passenger_id VARCHAR(10) PRIMARY KEY,
    user_id VARCHAR(10) NOT NULL,
    loyalty_status ENUM('Regular', 'Green', 'Silver', 'Gold')
);


CREATE TABLE Dependents (
    dependent_id VARCHAR(10) PRIMARY KEY,
    passenger_id VARCHAR(10) NOT NULL,
    reservation_id INT,
    name VARCHAR(50),
    dependent_type ENUM('Child', 'Spouse', 'Parent') DEFAULT 'Child'
);


CREATE TABLE Staff (
    staff_id VARCHAR(10) PRIMARY KEY,
    user_id VARCHAR(10) NOT NULL,
    role ENUM('Driver', 'Engineer')
);


CREATE TABLE Trains (
    train_id VARCHAR(10) PRIMARY KEY,
    train_name VARCHAR(50),
    driver_id VARCHAR(10),
    engineer_id VARCHAR(10),
    total_cabin_seats INT NOT NULL,
    available_cabin_seats INT NOT NULL,
    total_firstclass_seats INT NOT NULL,
    available_firstclass_seats INT NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL
);


CREATE TABLE Seats (
    seat_id VARCHAR(10) NOT NULL,
    train_id VARCHAR(10) NOT NULL,
    ticket_id INT,
    seat_status ENUM('Free', 'Booked') NOT NULL DEFAULT 'Free',
    seat_class ENUM('First Class', 'Cabin') NOT NULL,
    PRIMARY KEY (seat_id, train_id)
);


CREATE TABLE Stations (
    station_id VARCHAR(10) PRIMARY KEY,
    station_name VARCHAR(100) UNIQUE
);


CREATE TABLE TrainStations (
    train_id VARCHAR(10) NOT NULL,
    station_id VARCHAR(10) NOT NULL,
    arrival_time DATETIME,
    departure_time DATETIME,
    PRIMARY KEY (train_id, station_id)
);


CREATE TABLE Reservations (
    reservation_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    passenger_id VARCHAR(10),
    dependent_id VARCHAR(10),
    train_id VARCHAR(10) NOT NULL,
    reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Confirmed', 'Waitlisted', 'Cancelled') NOT NULL
);


CREATE TABLE Tickets (
    ticket_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    seat_id VARCHAR(10) NOT NULL,
    train_id VARCHAR(10) NOT NULL
);


CREATE TABLE Payments (
    payment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10, 2) NOT NULL
);


ALTER TABLE Passengers
ADD CONSTRAINT fk_passengers_users FOREIGN KEY (user_id) REFERENCES Users(user_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Dependents
ADD CONSTRAINT fk_dependents_passengers FOREIGN KEY (passenger_id) REFERENCES Passengers(passenger_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_dependents_reservations FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Staff
ADD CONSTRAINT fk_staff_users FOREIGN KEY (user_id) REFERENCES Users(user_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Trains
ADD CONSTRAINT fk_trains_driver FOREIGN KEY (driver_id) REFERENCES Staff(staff_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_trains_engineer FOREIGN KEY (engineer_id) REFERENCES Staff(staff_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Seats
ADD CONSTRAINT fk_seats_trains FOREIGN KEY (train_id) REFERENCES Trains(train_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_seats_tickets FOREIGN KEY (ticket_id) REFERENCES Tickets(ticket_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE TrainStations
ADD CONSTRAINT fk_trainstations_trains FOREIGN KEY (train_id) REFERENCES Trains(train_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_trainstations_stations FOREIGN KEY (station_id) REFERENCES Stations(station_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Reservations
ADD CONSTRAINT fk_reservations_passengers FOREIGN KEY (passenger_id) REFERENCES Passengers(passenger_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_reservations_dependents FOREIGN KEY (dependent_id) REFERENCES Dependents(dependent_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_reservations_trains FOREIGN KEY (train_id) REFERENCES Trains(train_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Tickets
ADD CONSTRAINT fk_tickets_reservations FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id)
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT fk_tickets_seats FOREIGN KEY (seat_id, train_id) REFERENCES Seats(seat_id, train_id)
ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE Payments
ADD CONSTRAINT fk_payments_reservations FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id)
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE VIEW ReservationTrainView AS
SELECT 
    R.reservation_id,
    R.status AS reservation_status,
    T.train_id,
    T.train_name,
    TK.seat_id AS seat_number,
    s1.station_name AS departure_station,
    ts1.departure_time AS actual_departure_time,
    s2.station_name AS arrival_station,
    ts2.arrival_time AS actual_arrival_time
FROM 
    Reservations R
JOIN 
    Trains T ON R.train_id = T.train_id
JOIN 
    Tickets TK ON R.reservation_id = TK.reservation_id
JOIN 
    TrainStations ts1 ON T.train_id = ts1.train_id
JOIN 
    Stations s1 ON ts1.station_id = s1.station_id
JOIN 
    TrainStations ts2 ON T.train_id = ts2.train_id
JOIN 
    Stations s2 ON ts2.station_id = s2.station_id
WHERE 
    ts1.departure_time = (
        SELECT MIN(ts_min.departure_time)
        FROM TrainStations ts_min
        WHERE ts_min.train_id = T.train_id
    )
    AND ts2.arrival_time = (
        SELECT MAX(ts_max.arrival_time)
        FROM TrainStations ts_max
        WHERE ts_max.train_id = T.train_id
    );


DELIMITER //

CREATE TRIGGER after_ticket_insert
AFTER INSERT ON Tickets
FOR EACH ROW
BEGIN
    UPDATE Seats
    SET seat_status = 'Booked', ticket_id = NEW.ticket_id
    WHERE seat_id = NEW.seat_id AND train_id = NEW.train_id;
END;
//

DELIMITER ;

DELIMITER //

CREATE TRIGGER after_ticket_delete
AFTER DELETE ON Tickets
FOR EACH ROW
BEGIN
    UPDATE Seats
    SET seat_status = 'Free', ticket_id = NULL
    WHERE seat_id = OLD.seat_id AND train_id = OLD.train_id;
END;
//

DELIMITER ;




INSERT INTO Users (user_id, username, password, role, email)
VALUES
('U1', 'passenger1', 'p', 'Passenger', 'passenger1@example.com'),
('U2', 'passenger2', 'p', 'Passenger', 'passenger2@example.com'),
('U3', 'staff1', 'p', 'Staff', 'staff1@example.com'),
('U4', 'staff2', 'p', 'Staff', 'staff2@example.com'),
('U5', 'admin1', 'p', 'Admin', 'admin1@example.com');



INSERT INTO Passengers (passenger_id, user_id, loyalty_status)
VALUES
('P1', 'U1', 'Green'),
('P2', 'U2', 'Silver');


INSERT INTO Dependents (dependent_id, passenger_id, name, dependent_type)
VALUES
('D1', 'P1', 'Child1', 'Child'),
('D2', 'P2', 'Spouse1', 'Spouse');


INSERT INTO Staff (staff_id, user_id, role)
VALUES
('S1', 'U3', 'Driver'),
('S2', 'U4', 'Engineer');


INSERT INTO Trains (train_id, train_name, driver_id, engineer_id, total_cabin_seats, available_cabin_seats, total_firstclass_seats, available_firstclass_seats, departure_time, arrival_time)
VALUES
('T1', 'Express A', 'S1', 'S2', 10, 10, 5, 5, '2024-11-25 08:00:00', '2024-11-25 12:00:00'),
('T2', 'Express B', 'S1', 'S2', 8, 8, 4, 4, '2024-11-26 09:00:00', '2024-11-26 13:00:00');


INSERT INTO Stations (station_id, station_name)
VALUES
('ST1', 'Station Alpha'),
('ST2', 'Station Beta'),
('ST3', 'Station Gamma'),
('ST4', 'Station Delta');


INSERT INTO TrainStations (train_id, station_id, arrival_time, departure_time)
VALUES
('T1', 'ST1', '2024-11-25 07:30:00', '2024-11-25 08:00:00'),
('T1', 'ST2', '2024-11-25 09:30:00', '2024-11-25 09:45:00'),
('T1', 'ST3', '2024-11-25 11:30:00', '2024-11-25 11:45:00'),
('T1', 'ST4', '2024-11-25 12:00:00', NULL),
('T2', 'ST1', '2024-11-26 08:30:00', '2024-11-26 09:00:00'),
('T2', 'ST2', '2024-11-26 10:30:00', '2024-11-26 10:45:00'),
('T2', 'ST3', '2024-11-26 12:30:00', '2024-11-26 12:45:00'),
('T2', 'ST4', '2024-11-26 13:00:00', NULL);


INSERT INTO Seats (seat_id, train_id, seat_status, seat_class)
VALUES
('T1-C1', 'T1', 'Free', 'Cabin'),
('T1-C2', 'T1', 'Free', 'Cabin'),
('T1-C3', 'T1', 'Free', 'Cabin'),
('T1-C4', 'T1', 'Free', 'Cabin'),
('T1-C5', 'T1', 'Free', 'Cabin'),
('T1-C6', 'T1', 'Free', 'Cabin'),
('T1-C7', 'T1', 'Free', 'Cabin'),
('T1-C8', 'T1', 'Free', 'Cabin'),
('T1-C9', 'T1', 'Free', 'Cabin'),
('T1-C10', 'T1', 'Free', 'Cabin'),
('T1-F1', 'T1', 'Free', 'First Class'),
('T1-F2', 'T1', 'Free', 'First Class'),
('T1-F3', 'T1', 'Free', 'First Class'),
('T1-F4', 'T1', 'Free', 'First Class'),
('T1-F5', 'T1', 'Free', 'First Class'),
('T2-C1', 'T2', 'Free', 'Cabin'),
('T2-C2', 'T2', 'Free', 'Cabin'),
('T2-C3', 'T2', 'Free', 'Cabin'),
('T2-C4', 'T2', 'Free', 'Cabin'),
('T2-C5', 'T2', 'Free', 'Cabin'),
('T2-C6', 'T2', 'Free', 'Cabin'),
('T2-C7', 'T2', 'Free', 'Cabin'),
('T2-C8', 'T2', 'Free', 'Cabin'),
('T2-F1', 'T2', 'Free', 'First Class'),
('T2-F2', 'T2', 'Free', 'First Class'),
('T2-F3', 'T2', 'Free', 'First Class'),
('T2-F4', 'T2', 'Free', 'First Class');
