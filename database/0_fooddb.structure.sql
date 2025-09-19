CREATE DATABASE IF NOT EXISTS cactus_db;
USE cactus_db;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP TABLE IF EXISTS `admin`;
CREATE TABLE `admin` (
  `Aid` int NOT NULL AUTO_INCREMENT,
  `Aname` varchar(255) DEFAULT NULL,
  `Aaddress` varchar(255) DEFAULT NULL,
  `Ausername` varchar(50) DEFAULT NULL,
  `Apassword` varchar(50) DEFAULT NULL,
  `Aphone` varchar(15) DEFAULT NULL,
  `Astatus` varchar(50) DEFAULT NULL,
  `Adate` date DEFAULT NULL,
  `Abirth` date DEFAULT NULL,
  PRIMARY KEY (`Aid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `auction_products`;
CREATE TABLE `auction_products` (
  `PROid` int NOT NULL AUTO_INCREMENT,
  `PROname` varchar(255) DEFAULT NULL,
  `PROprice` decimal(10,2) DEFAULT NULL,
  `PROrenume` int DEFAULT NULL,
  `PROstatus` varchar(50) DEFAULT NULL,
  `PROpicture` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`PROid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `Cid` int NOT NULL AUTO_INCREMENT,
  `Cname` varchar(255) DEFAULT NULL,
  `Caddress` varchar(255) DEFAULT NULL,
  `Cusername` varchar(50) DEFAULT NULL,
  `Cpassword` varchar(255) DEFAULT NULL,
  `Cphone` varchar(15) DEFAULT NULL,
  `Cstatus` varchar(50) DEFAULT NULL,
  `Cdate` date DEFAULT NULL,
  `Cbirth` date DEFAULT NULL,
  `Csubdistrict` varchar(100) DEFAULT NULL,
  `Cdistrict` varchar(100) DEFAULT NULL,
  `Cprovince` varchar(100) DEFAULT NULL,
  `Czipcode` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`Cid`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `Oiid` int NOT NULL AUTO_INCREMENT,
  `Oid` int NOT NULL,
  `Pid` int NOT NULL,
  `Oquantity` int NOT NULL,
  `Oprice` decimal(10,2) NOT NULL,
  PRIMARY KEY (`Oiid`),
  KEY `Oid` (`Oid`),
  KEY `Pid` (`Pid`),
  CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`Oid`) REFERENCES `orders` (`Oid`) ON DELETE CASCADE,
  CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`Pid`) REFERENCES `products` (`Pid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `Oid` int NOT NULL AUTO_INCREMENT,
  `Oprice` decimal(10,2) DEFAULT NULL,
  `Odate` date DEFAULT NULL,
  `Ostatus` varchar(50) DEFAULT NULL,
  `Cid` int DEFAULT NULL,
  PRIMARY KEY (`Oid`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `Payid` int NOT NULL AUTO_INCREMENT,
  `Oid` int NOT NULL,
  `Payprice` decimal(10,2) DEFAULT NULL,
  `Paydate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Paystatus` varchar(50) DEFAULT 'waiting',
  `SlipUrl` text,
  PRIMARY KEY (`Payid`),
  KEY `Oid` (`Oid`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`Oid`) REFERENCES `orders` (`Oid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `product_types`;
CREATE TABLE `product_types` (
  `Typeid` int NOT NULL AUTO_INCREMENT,
  `typenproduct` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Typeid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `Pid` int NOT NULL AUTO_INCREMENT,
  `Pname` varchar(255) DEFAULT NULL,
  `Pprice` decimal(10,2) DEFAULT NULL,
  `Pnumproduct` int DEFAULT NULL,
  `Prenume` int DEFAULT NULL,
  `Pstatus` varchar(50) DEFAULT NULL,
  `Ppicture` varchar(255) DEFAULT NULL,
  `Pdetail` text,
  PRIMARY KEY (`Pid`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `questions`;
CREATE TABLE `questions` (
  `Askid` int NOT NULL AUTO_INCREMENT,
  `Asktopic` varchar(255) DEFAULT NULL,
  `Askaccount` varchar(255) DEFAULT NULL,
  `Askdate` date DEFAULT NULL,
  `Askmail` varchar(255) DEFAULT NULL,
  `Askdetails` text,
  `Askvisits` int DEFAULT NULL,
  PRIMARY KEY (`Askid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `replies`;
CREATE TABLE `replies` (
  `Replyid` int NOT NULL AUTO_INCREMENT,
  `Askid` int DEFAULT NULL,
  `Replydetails` text,
  `Replydate` date DEFAULT NULL,
  `Replyaccount` varchar(255) DEFAULT NULL,
  `Replymail` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Replyid`),
  KEY `Askid` (`Askid`),
  CONSTRAINT `replies_ibfk_1` FOREIGN KEY (`Askid`) REFERENCES `questions` (`Askid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `reviews`;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `text` text NOT NULL,
  `stars` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `reviews_chk_1` CHECK ((`stars` between 1 and 5))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `Tid` int NOT NULL AUTO_INCREMENT,
  `Tname` varchar(255) DEFAULT NULL,
  `Tnum` int DEFAULT NULL,
  `Taccount` varchar(255) DEFAULT NULL,
  `Tbranch` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Tid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;





INSERT INTO `customers` (`Cid`, `Cname`, `Caddress`, `Cusername`, `Cpassword`, `Cphone`, `Cstatus`, `Cdate`, `Cbirth`, `Csubdistrict`, `Cdistrict`, `Cprovince`, `Czipcode`) VALUES
(1, 'Jane Smith', '456 Elm Street, Townsville', 'janesmith456', 'pass456', '555-5678', 'Inactive', '2023-07-20', '1985-10-20', NULL, NULL, NULL, NULL);
INSERT INTO `customers` (`Cid`, `Cname`, `Caddress`, `Cusername`, `Cpassword`, `Cphone`, `Cstatus`, `Cdate`, `Cbirth`, `Csubdistrict`, `Cdistrict`, `Cprovince`, `Czipcode`) VALUES
(3, 'ตะเอ๊ง ตัวจริง', NULL, 'tuaeeng123', '$2a$10$50Tvk6Lrt4LMrfzy/VE.7e4LU5j56JAfxkDhGbp2bWXCxq10U7g9.', NULL, 'user', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `customers` (`Cid`, `Cname`, `Caddress`, `Cusername`, `Cpassword`, `Cphone`, `Cstatus`, `Cdate`, `Cbirth`, `Csubdistrict`, `Cdistrict`, `Cprovince`, `Czipcode`) VALUES
(4, 'John Doe', NULL, 'johndoe123', '$2a$10$myFyhGN1ZwUlF43DeuL1JOpcc.xd1GbKD1F8UjofpoFexdhxiw8ze', NULL, 'user', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `customers` (`Cid`, `Cname`, `Caddress`, `Cusername`, `Cpassword`, `Cphone`, `Cstatus`, `Cdate`, `Cbirth`, `Csubdistrict`, `Cdistrict`, `Cprovince`, `Czipcode`) VALUES
(5, 'จินดา วงศ์', '33/8', 'lipid23', '$2a$10$k4wP2G7Xw0tTkq1.n/ZVUeoyAQK.MG4S0SU5QP13PF4DXR0dXBWXK', '0866658246', 'user', NULL, NULL, 'บ้านใหม่', 'ปากเกร็ด', 'นนทบุรี', '11120'),
(6, 'ฟฟฟฟ กกกก', NULL, 'liw844@gmail.com', '$2a$10$LYWmHSfA5dlWPL7mHU0/PO3zT.VWFMtv.ltXSFOc8S4REhHQDKVCK', NULL, 'user', NULL, NULL, NULL, NULL, NULL, NULL),
(7, 'นายนนกุล พิกุล', '212', 'นนกุล2544', '$2a$10$hf/P5lUwTsqu4jyGSFiUHO/SyIvxDCI0SCpPJpG6ObW/X4LkHQdMi', '0915682497', 'user', NULL, NULL, 'แพ้ว', 'บ้านย่า', 'กทม', '11120'),
(8, 'งูจงเห่า', '137 หมู่ล่ำซำ บ้านข่า ชัยภูมิ 36170', 'zzzzz', '$2a$10$RaKa5BkBf766G/Sl3/arLu.E.Phza18nTAsIKVtc8Ce8aCZsfBKL2', '0981234567', 'user', '2025-06-09', '2001-11-22', NULL, NULL, NULL, NULL),
(9, 'ตะเอ๊ง ตัวจริง', '137 หมู่ 4 บ้านข่า', 'eng123', '$2a$10$g./5Ri//4HTW1ytEbxwxa.JtR1I0eSeW5cB6aDer9pK6BIPWOcwdS', '0981234567', 'user', '2025-06-09', '2000-01-03', 'บ้านข่า', 'เกษตรสมบูรณ์', 'ชัยภูมิ', '36160'),
(10, 'หนูเภา วิ', '137 หมู่ 4 บ้านข่า', 'eng1234', '$2a$10$Fby0S1.XiqF153AD39NVNewmD7N2CNQVHu.Vw/CBmOIgDknlWymQO', '0981234567', 'user', '2025-06-09', '2000-01-03', 'บ้านข่า', 'เกษตรสมบูรณ์', 'ชัยภูมิ', '36160'),
(11, 'ทิวธวัฒน์ สมอุ่มจาน', '123/45 หมู่บ้านตัวอย่าง', 'tiwthawat@example.com', '$2a$10$z1weqUnMXr6RoAodobN6ZutKW/HFZI9al2sEsUnnYFlCINAb.sJEK', '0912345678', 'user', '2025-06-17', '2001-08-15', 'บางพูด', 'ปากเกร็ด', 'นนทบุรี', '11120'),
(12, 'นายทิวา วา', '555', 'tiwa20', '$2a$10$NA6MQjTN8vWjmNpfx.RNN.N35PCATshg5Yeq9L.o8zvp/QWqSqpVS', '0981111111', 'user', '2025-06-17', '2001-02-12', 'ลุ่มปลาเฒ่า', 'บ้านเขว้า', 'ชัยภูมิ', '36170'),
(13, 'ทิวธวัฒน์ อุ่มจาน', '123/45 หมู่บ้านตัวอย่าง', 'tiwthawat', '$2a$10$SlahV4l4IDRvX3o09xZ17eeR/Lq/Zv6C5o9QsFcGAyXcVU3QFShCy', '0912345678', 'user', '2025-06-18', '2001-08-15', 'บางพูด', 'ปากเกร็ด', 'นนทบุรี', '11120');

INSERT INTO `order_items` (`Oiid`, `Oid`, `Pid`, `Oquantity`, `Oprice`) VALUES
(1, 1, 1, 2, '100.00');
INSERT INTO `order_items` (`Oiid`, `Oid`, `Pid`, `Oquantity`, `Oprice`) VALUES
(2, 1, 2, 1, '250.00');
INSERT INTO `order_items` (`Oiid`, `Oid`, `Pid`, `Oquantity`, `Oprice`) VALUES
(3, 2, 1, 2, '100.00');
INSERT INTO `order_items` (`Oiid`, `Oid`, `Pid`, `Oquantity`, `Oprice`) VALUES
(4, 2, 3, 1, '250.00'),
(5, 3, 1, 2, '100.00'),
(6, 3, 3, 1, '250.00'),
(7, 4, 1, 2, '100.00'),
(8, 4, 3, 1, '250.00'),
(9, 5, 1, 2, '100.00'),
(10, 5, 3, 1, '250.00'),
(11, 6, 5, 2, '50.00'),
(12, 6, 4, 9, '50.00'),
(13, 6, 3, 4, '50.00'),
(14, 7, 3, 2, '50.00'),
(15, 7, 2, 3, '50.00'),
(16, 7, 9, 1, '70.00'),
(17, 8, 2, 1, '50.00'),
(18, 8, 8, 2, '70.00'),
(19, 8, 4, 1, '50.00'),
(20, 8, 10, 2, '70.00'),
(21, 9, 2, 2, '50.00'),
(22, 9, 7, 2, '70.00'),
(23, 10, 2, 2, '50.00'),
(24, 10, 9, 2, '70.00'),
(25, 10, 7, 1, '70.00'),
(26, 10, 6, 3, '70.00'),
(27, 11, 3, 2, '50.00'),
(28, 11, 9, 3, '70.00'),
(29, 11, 10, 1, '70.00'),
(30, 11, 6, 2, '70.00'),
(31, 11, 5, 1, '50.00'),
(32, 12, 2, 1, '50.00'),
(33, 12, 6, 4, '70.00'),
(34, 13, 2, 2, '50.00'),
(35, 13, 9, 3, '70.00'),
(36, 13, 10, 2, '70.00'),
(37, 14, 1, 3, '50.00'),
(38, 14, 9, 1, '70.00'),
(39, 14, 7, 3, '70.00');

INSERT INTO `orders` (`Oid`, `Oprice`, `Odate`, `Ostatus`, `Cid`) VALUES
(1, '450.00', '2025-06-19', 'pending', 1);
INSERT INTO `orders` (`Oid`, `Oprice`, `Odate`, `Ostatus`, `Cid`) VALUES
(2, '450.00', '2025-06-19', 'pending', 1);
INSERT INTO `orders` (`Oid`, `Oprice`, `Odate`, `Ostatus`, `Cid`) VALUES
(3, '450.00', '2025-06-19', 'pending', 1);
INSERT INTO `orders` (`Oid`, `Oprice`, `Odate`, `Ostatus`, `Cid`) VALUES
(4, '450.00', '2025-06-19', 'pending', 1),
(5, '450.00', '2025-06-19', 'pending', 12),
(6, '750.00', '2025-06-19', 'cancelled', 5),
(7, '320.00', '2025-06-19', 'cancelled', 5),
(8, '380.00', '2025-06-19', 'cancelled', 5),
(9, '240.00', '2025-06-19', 'cancelled', 5),
(10, '520.00', '2025-06-19', 'cancelled', 5),
(11, '570.00', '2025-06-20', 'cancelled', 5),
(12, '330.00', '2025-06-20', 'cancelled', 5),
(13, '450.00', '2025-06-20', 'cancelled', 5),
(14, '430.00', '2025-06-20', 'waiting', 5);

INSERT INTO `payments` (`Payid`, `Oid`, `Payprice`, `Paydate`, `Paystatus`, `SlipUrl`) VALUES
(1, 4, '450.00', '2025-06-19 23:30:33', 'waiting', '/slips/1750375833640-248522693.jpg');
INSERT INTO `payments` (`Payid`, `Oid`, `Payprice`, `Paydate`, `Paystatus`, `SlipUrl`) VALUES
(2, 10, '520.00', '2025-06-19 23:45:29', 'waiting', '/slips/1750376729849-982801340.jpg');
INSERT INTO `payments` (`Payid`, `Oid`, `Payprice`, `Paydate`, `Paystatus`, `SlipUrl`) VALUES
(3, 11, '570.00', '2025-06-20 00:12:16', 'waiting', '/slips/1750378336062-718549742.jpg');
INSERT INTO `payments` (`Payid`, `Oid`, `Payprice`, `Paydate`, `Paystatus`, `SlipUrl`) VALUES
(4, 12, '330.00', '2025-06-20 00:16:00', 'waiting', '/slips/1750378560444-919985367.jpg'),
(5, 13, '450.00', '2025-06-20 00:35:59', 'waiting', '/slips/1750379759547-86134413.jpg'),
(6, 14, '430.00', '2025-06-20 00:42:24', 'waiting', '/slips/1750380144481-143919309.jpg');



INSERT INTO `products` (`Pid`, `Pname`, `Pprice`, `Pnumproduct`, `Prenume`, `Pstatus`, `Ppicture`, `Pdetail`) VALUES
(1, 'เดย์ดรีม (Gymnocalycium ‘Daydream’)', '50.00', 100, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', 'แคคตัสสายพันธุ์หายาก สีเขียวอมม่วง ทนแล้ง เหมาะกับคนไม่มีเวลา');
INSERT INTO `products` (`Pid`, `Pname`, `Pprice`, `Pnumproduct`, `Prenume`, `Pstatus`, `Ppicture`, `Pdetail`) VALUES
(2, 'ซีเปีย (Gymnocalycium ‘Sepia’)', '50.00', 150, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL);
INSERT INTO `products` (`Pid`, `Pname`, `Pprice`, `Pnumproduct`, `Prenume`, `Pstatus`, `Ppicture`, `Pdetail`) VALUES
(3, 'แคคตัสทรายแช่น้ำสีเขียว', '50.00', 120, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg,https://images.pexels.com/photos/4581905/pexels-photo-4581905.jpeg,https://images.pexels.com/photos/1207978/pexels-photo-1207978.jpeg', 'แคคตัสสายพันธุ์หายาก สีเขียวอมม่วง ทนแล้ง เหมาะกับคนไม่มีเวลา');
INSERT INTO `products` (`Pid`, `Pname`, `Pprice`, `Pnumproduct`, `Prenume`, `Pstatus`, `Ppicture`, `Pdetail`) VALUES
(4, 'แคคตัสทรายแช่น้ำสีเหลือง', '50.00', 80, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(5, 'แคคตัสทรายแช่น้ำสีชมพู', '50.00', 90, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(6, 'แคคตัสสีขาวขนาดใหญ่', '70.00', 70, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(7, 'แคคตัสสีดำขนาดใหญ่', '70.00', 60, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(8, 'แคคตัสสีน้ำเงินขนาดใหญ่', '70.00', 80, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(9, 'แคคตัสสีเขียวขนาดใหญ่', '70.00', 100, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL),
(10, 'แคคตัสสีแดงขนาดใหญ่', '70.00', 110, 0, 'In stock', 'https://pbs.twimg.com/media/EublzC5UUAUbJDB.jpg', NULL);





INSERT INTO `reviews` (`id`, `text`, `stars`, `created_at`) VALUES
(1, 'แคคตัสน่ารักมาก ส่งเร็ว แพ็กดีสุด ๆ', 5, '2025-06-03 18:56:52');
INSERT INTO `reviews` (`id`, `text`, `stars`, `created_at`) VALUES
(2, 'สีสวย ต้นสมบูรณ์ แต่ส่งช้าหน่อย', 4, '2025-06-03 18:56:52');
INSERT INTO `reviews` (`id`, `text`, `stars`, `created_at`) VALUES
(3, 'ต้นเล็กกว่าที่คิดนิดนึง แต่โดยรวมโอเค', 3, '2025-06-03 18:56:52');
INSERT INTO `reviews` (`id`, `text`, `stars`, `created_at`) VALUES
(4, 'มีรอยช้ำเล็กน้อยตอนแกะกล่อง', 2, '2025-06-03 18:56:52'),
(5, 'ต้นตายตอนมาถึงเลย เสียใจมาก 🥲', 3, '2025-06-03 18:56:52'),
(6, 'ชอบร้านนี้มาก ส่งไว บริการดี', 5, '2025-06-03 19:13:52'),
(7, 'เจ้าของน่ารัก', 5, '2025-06-03 19:30:32');






/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;