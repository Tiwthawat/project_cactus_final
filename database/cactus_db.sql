-- MySQL dump 10.13  Distrib 8.0.32, for Linux (x86_64)
--
-- Host: localhost    Database: cactus_db
-- ------------------------------------------------------
-- Server version	8.0.32

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `cactus_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `cactus_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `cactus_db`;

--
-- Table structure for table `admin`
--

DROP TABLE IF EXISTS `admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin` (
  `Aid` int NOT NULL AUTO_INCREMENT,
  `Aname` varchar(255) DEFAULT NULL,
  `Aaddress` varchar(255) DEFAULT NULL,
  `Ausername` varchar(50) DEFAULT NULL,
  `Apassword` varchar(255) NOT NULL,
  `Aphone` varchar(15) DEFAULT NULL,
  `Astatus` varchar(50) DEFAULT NULL,
  `Adate` date DEFAULT NULL,
  `Abirth` date DEFAULT NULL,
  PRIMARY KEY (`Aid`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin`
--

LOCK TABLES `admin` WRITE;
/*!40000 ALTER TABLE `admin` DISABLE KEYS */;
INSERT INTO `admin` VALUES (1,'Super Admin','สำนักงานใหญ่','admin','admin123','0800000001','active','2025-12-24','1990-01-01'),(2,'Staff One','สาขา A','staff1','staff123','0800000002','active','2025-12-24','1995-02-02'),(3,'Staff Two','สาขา B','staff2','staff123','0800000003','active','2025-12-24','1996-03-03'),(4,'Moderator','ออนไลน์','mod','mod123','0800000004','active','2025-12-24','1994-04-04'),(5,'Admin','สำนักงานใหญ่','admin','admin1234','0800000011','active','2025-12-24','1990-02-01');
/*!40000 ALTER TABLE `admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auction_payments`
--

DROP TABLE IF EXISTS `auction_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auction_payments` (
  `Payid` int NOT NULL AUTO_INCREMENT,
  `Aid` int NOT NULL,
  `PROid` int NOT NULL,
  `winner_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `slip` varchar(255) NOT NULL,
  `paid_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) NOT NULL DEFAULT 'pending_payment',
  PRIMARY KEY (`Payid`),
  KEY `Aid` (`Aid`),
  KEY `PROid` (`PROid`),
  KEY `winner_id` (`winner_id`),
  CONSTRAINT `auction_payments_ibfk_1` FOREIGN KEY (`Aid`) REFERENCES `auctions` (`Aid`),
  CONSTRAINT `auction_payments_ibfk_2` FOREIGN KEY (`PROid`) REFERENCES `auction_products` (`PROid`),
  CONSTRAINT `auction_payments_ibfk_3` FOREIGN KEY (`winner_id`) REFERENCES `customers` (`Cid`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auction_payments`
--

LOCK TABLES `auction_payments` WRITE;
/*!40000 ALTER TABLE `auction_payments` DISABLE KEYS */;
INSERT INTO `auction_payments` VALUES (1,52,36,17,55.00,'1763415790964-157816080.jpg','2025-11-18 04:43:10','paid'),(2,50,34,16,30.00,'1763416708669-108755484.jpeg','2025-11-18 04:58:28','paid'),(7,60,42,17,149.00,'1763544633606-770919750.jpeg','2025-11-19 16:30:33','paid'),(8,61,43,17,177.00,'/slips/1763553003103-178970435.jpg','2025-11-19 18:50:03','paid'),(9,77,60,12,49.00,'/slips/1766635759760-393481855.png','2025-12-25 11:09:19','paid'),(10,78,62,18,59.00,'/slips/1766640103824-266630220.png','2025-12-25 12:21:43','paid'),(11,79,59,17,45.00,'/slips/1768164813285-628653147.png','2026-01-12 03:53:33','paid'),(12,75,57,17,28.00,'/slips/1770109499993-669089397.png','2026-02-03 16:04:59','paid'),(13,71,53,17,31.00,'/slips/1770110896706-937611224.png','2026-02-03 16:28:16','paid'),(14,90,77,12,80.00,'/slips/1771258719180-292203185.jpg','2026-02-16 23:18:39','paid'),(15,89,76,18,380.00,'/slips/1771344213197-499508448.jpeg','2026-02-17 23:03:33','payment_review');
/*!40000 ALTER TABLE `auction_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auction_products`
--

DROP TABLE IF EXISTS `auction_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auction_products` (
  `PROid` int NOT NULL AUTO_INCREMENT,
  `PROname` varchar(255) DEFAULT NULL,
  `PROprice` decimal(10,2) DEFAULT NULL,
  `PROstatus` enum('ready','auction','pending_payment','payment_review','paid','unsold') NOT NULL DEFAULT 'ready',
  `PROpicture` varchar(255) DEFAULT NULL,
  `PROdetail` text,
  `shipping_company` varchar(100) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `shipping_status` enum('pending','shipped','delivered') DEFAULT 'pending',
  PRIMARY KEY (`PROid`)
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auction_products`
--

LOCK TABLES `auction_products` WRITE;
/*!40000 ALTER TABLE `auction_products` DISABLE KEYS */;
INSERT INTO `auction_products` VALUES (27,'YYYY',100.00,'paid','/products/1758829494473-738694614.jpeg,/products/1758829494481-636912891.jpg,/products/1758829494538-674820854.webp,/products/1758829494586-774783831.png','mfdmmb;lc',NULL,NULL,'pending'),(33,'0001',25.00,'paid','/products/1762100774563-639365035.webp','วสทวสาแอป่้ิสา',NULL,NULL,'pending'),(34,'1111',25.00,'paid','','klmbgfd','ThaiPost','EX123456785TH','shipped'),(36,'333',25.00,'paid','/products/1763310454327-393105181.jpg',';dfd','Flash','TH1234567890','delivered'),(41,'8888',85.00,'pending_payment','/products/1763310539152-65440923.jpg',';k/fsdgvkdfkl',NULL,NULL,'pending'),(42,'9999',99.00,'paid','/products/1763310553748-572182582.jpg','gfdk;ljhlfdjhik','Kerry','KT152455878TH','shipped'),(43,'1010101',100.00,'paid','/products/1763310571951-47274759.jpg','k;sdfoo;kh','ThaiPost','EX123456780TH','delivered'),(45,'12.12.12.',12.00,'pending_payment','/products/1763401917709-931675041.jpg','ฝสหทมใกอทแสาผ',NULL,NULL,'pending'),(46,'13.13.13',13.00,'pending_payment','/products/1763401937239-817680337.jpg','กทหสาอทแใมอป',NULL,NULL,'pending'),(47,'14.14.14.14',14.00,'pending_payment','/products/1763401960543-534281379.jpg','ททแปทใผืิมื',NULL,NULL,'pending'),(53,'20.20.20',20.00,'paid','/products/1764095250527-514542511.jpg','าาเ่ดะ้ก้',NULL,NULL,'pending'),(57,'24.24.24',24.00,'paid','/products/1766406826047-121044865.jpg','ือา่สกหดาห่เอื่ก','J&T','JT12547896TH','delivered'),(59,'26.26.26',26.00,'paid','/products/1766407182908-700967821.jpg','่กหด้กดห้เา่','ThaiPost','TH122246578TH','delivered'),(60,'27.27.27',27.00,'paid','/products/1766407216105-709149205.jpg','เทงสพห้ทสะพห้','ThaiPost','EX123456788TH','delivered'),(61,'28.28.28',28.00,'unsold','/products/1766407239844-154274053.jpg','อปมใผทอาวสกด่นิ้เดิ',NULL,NULL,'pending'),(62,'30.30.30',30.00,'paid','/products/1766639974695-164621323.png','กหดอห เใ','Flash','TH1234567877','delivered'),(64,'31.31.31',31.00,'unsold','/products/1769154567457-176641575.png','พกแแปผอแผ',NULL,NULL,'pending'),(65,'32',32.00,'unsold','/products/1769154590239-82973908.png','หแผปทวสาทื',NULL,NULL,'pending'),(66,'33.',33.00,'unsold','/products/1769154607335-323732437.png','แกหแกหาสผสแ',NULL,NULL,'pending'),(67,'34',34.00,'unsold','/products/1769154623771-974755709.jpg','แผหแห',NULL,NULL,'pending'),(68,'35',35.00,'unsold','/products/1769154641007-309135685.png','กแปผแอ',NULL,NULL,'pending'),(69,'Melocactus Makiun',2500.00,'ready','/products/1771142101494-571990582.jpg','แคคตัสหายาก ',NULL,NULL,'pending'),(70,'แคคตัสยิมโนคาไลเซียม',900.00,'ready','/products/1771142217779-232801379.png','นิยมเรียกสั้นๆ ว่า “ยิมโน” มีลักษณะเป็นลำต้นเดี่ยว แตกหน่อจากตุ่มหนาม หนามมีรูปทรงและขนาดหลากหลาย ดอกจะออกจากตุ่มหนามบริเวณยอด ยิมโนที่มีลักษณะด่าง คือมีสีหนึ่งแซมกับอีกสีหนึ่ง เป็นที่นิยมอย่างมากในหมู่คนเลี้ยงไม้สะสม',NULL,NULL,'pending'),(71,'แคคตัสแอสโตรไฟตัม',500.00,'ready','/products/1771142307365-966250798.png','ที่มาของชื่อ\nมาจากการรวมกันของสองคำในภาษากรีกคือคำว่า “astron” คือ ดาว และ “phyton” คือ พืช ชื่อ Astrophytum จึงหมายถึง แคคตัสที่มีรูปดาว หรือลักษณะคล้ายดาวนั่นเอง\nจุดเด่น\nลักษณะเด่นของแคคตัสพันธุ์นี้ คือ ไม่มีหนาม ทำให้ดูแลง่าย มีชื่อเรียกในภาษาญี่ปุ่นว่า Kabuto (คาบูโตะ)「兜」 แปลว่าหมวก หรือหมวกซามูไรของญี่ปุ่น เป็นต้นเกือบกลม แบ่งออกเป็นหลายพู มีร่องระหว่างพูค่อนข้างตื้น บางชนิดเมื่อโตขึ้นจะมีหนามงอกออกมา มีความพิเศษอยู่ที่ลักษณะลำต้นที่แปลกตาในแต่ละสายพันธุ์ย่อย รวมถึงแอสโตรด่าง ที่มีสีที่เป็นเอกลักษณ์\n\n',NULL,NULL,'pending'),(72,'แคคตัสแมมมิลลาเรีย',800.00,'ready','/products/1771142357298-185452108.png','เป็นแคคตัสที่มีลักษณะหนามสวย ขนฟู มีหัวจุกเป็นตุ่ม เรียงรายอยู่รอบลำต้น มีดอกได้ครั้งละหลายดอกพร้อมกัน บางชนิดดอกบานพร้อมกันเป็นวงรอบต้น หรือที่เรียกกันว่า “มงลง” สามารถเลี้ยงได้ทั้งรูปทรงเดียว หรือให้แตกหน่อ โตขึ้นเป็นกอพร้อมๆ กัน',NULL,NULL,'pending'),(73,'แคคตัสโครีแฟนทา',300.00,'ready','/products/1771142418141-489107309.png','ทรงตรงมีได้หลายรูปแบบ ทั้งทรงกลม ทรงกระบอก ทรงแท่ง ตุ่มหนามมีลักษณะทรงกลมหรือรูปไข่ ลักษณะของนามจะกระจายออกจากตุ่มหนาม ออกดอกหลากหลายสีสัน ทั้งเหลือง ชมพู ส้ม ม่วง แดง\nในประเทศไทย Coryphantha elephantidens เป็นที่นิยมในหมู่นักเลี้ยง จึงนิยมเรียกชื่อเล่นว่า “ช้าง” ',NULL,NULL,'pending'),(74,'36',36.00,'unsold','/products/1771142509996-721957287.jpg,/products/1771142524276-226447737.jpg','กหดอกหกห',NULL,NULL,'pending'),(76,'38',360.50,'payment_review','/products/1771250952316-271069822.jpg','ิดอแ',NULL,NULL,'pending'),(77,'40',40.00,'paid','/products/1771256478711-582767202.webp','กหแป',NULL,NULL,'pending'),(79,'ขขขขขข',254.00,'pending_payment','/products/1771396531509-856709828.jpg','กผแปเอ',NULL,NULL,'pending'),(80,'คคค',9999.00,'unsold','/products/1771396552360-357225818.png,/products/1771396552418-289843981.png,/products/1771396552479-294770721.png','กอผปิเอกหผ',NULL,NULL,'pending'),(82,'จจจจจ',99.00,'unsold','/products/1771396581527-192105978.png','กเแปิเ',NULL,NULL,'pending');
/*!40000 ALTER TABLE `auction_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auctions`
--

DROP TABLE IF EXISTS `auctions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auctions` (
  `Aid` int NOT NULL AUTO_INCREMENT,
  `PROid` int NOT NULL,
  `start_price` decimal(10,2) NOT NULL,
  `current_price` decimal(10,2) NOT NULL,
  `end_time` datetime NOT NULL,
  `winner_id` int DEFAULT NULL,
  `status` enum('open','closed') DEFAULT 'open',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `min_increment` int NOT NULL DEFAULT '1',
  `payment_status` enum('pending_payment','payment_review','paid','expired') DEFAULT 'pending_payment',
  PRIMARY KEY (`Aid`),
  UNIQUE KEY `ux_auctions_one_active_per_product` (`PROid`),
  CONSTRAINT `auctions_ibfk_1` FOREIGN KEY (`PROid`) REFERENCES `auction_products` (`PROid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auctions`
--

LOCK TABLES `auctions` WRITE;
/*!40000 ALTER TABLE `auctions` DISABLE KEYS */;
INSERT INTO `auctions` VALUES (34,27,120.00,241.00,'2025-09-26 03:20:00',14,'closed','2025-09-26 03:17:30','2026-02-15 16:57:59',10,'expired'),(47,33,59.00,149.00,'2025-11-02 23:30:00',15,'closed','2025-11-02 23:26:48','2026-02-15 16:57:59',15,'expired'),(50,34,20.00,30.00,'2025-11-16 23:59:00',16,'closed','2025-11-16 23:30:04','2025-11-21 09:57:15',1,'paid'),(52,36,18.00,55.00,'2025-11-17 03:03:00',17,'closed','2025-11-16 23:33:31','2025-11-21 09:56:52',3,'paid'),(57,41,79.00,290.00,'2025-12-01 00:07:00',17,'closed','2025-11-16 23:37:22','2026-02-15 16:57:59',19,'expired'),(60,42,90.00,149.00,'2025-11-19 16:05:00',17,'closed','2025-11-19 16:01:35','2026-02-03 16:35:36',10,'paid'),(61,43,69.00,177.00,'2025-11-19 16:13:00',17,'closed','2025-11-19 16:11:08','2025-11-21 09:57:15',10,'paid'),(63,45,12.00,18.00,'2025-11-22 15:00:00',17,'closed','2025-11-21 15:27:50','2026-02-15 16:57:59',6,'expired'),(64,46,15.00,25.00,'2025-11-23 19:00:00',14,'closed','2025-11-21 15:28:19','2026-02-15 16:57:59',3,'expired'),(65,47,14.00,55.00,'2025-11-21 15:39:00',17,'closed','2025-11-21 15:37:16','2026-02-15 16:57:59',5,'expired'),(71,53,20.00,31.00,'2026-01-10 20:30:00',17,'closed','2025-12-22 19:43:52','2026-02-03 16:28:57',2,'paid'),(75,57,24.00,28.00,'2025-12-27 20:20:00',17,'closed','2025-12-22 19:46:14','2026-02-03 16:07:00',4,'paid'),(77,60,27.00,49.00,'2025-12-25 11:05:00',12,'closed','2025-12-25 11:00:14','2025-12-25 11:10:56',3,'paid'),(78,62,30.00,59.00,'2025-12-25 12:21:00',18,'closed','2025-12-25 12:20:02','2025-12-25 12:22:15',5,'paid'),(79,59,30.00,45.00,'2026-02-13 09:53:46',17,'closed','2025-12-25 13:58:44','2026-02-15 16:57:59',5,'expired'),(81,61,28.00,28.00,'2026-01-13 22:09:00',NULL,'closed','2026-01-13 21:39:55','2026-01-13 22:09:50',1,'pending_payment'),(82,65,20.00,20.00,'2026-01-23 15:20:00',NULL,'closed','2026-01-23 14:51:07','2026-01-23 15:20:25',1,'pending_payment'),(83,67,34.00,34.00,'2026-01-23 15:45:00',NULL,'closed','2026-01-23 14:51:34','2026-01-23 23:09:30',5,'pending_payment'),(84,64,31.00,31.00,'2026-02-13 09:35:15',NULL,'closed','2026-01-23 14:51:56','2026-02-15 09:35:15',100,'pending_payment'),(85,66,33.00,33.00,'2026-01-23 15:55:00',NULL,'closed','2026-01-23 14:52:49','2026-01-23 23:09:30',15,'pending_payment'),(86,68,35.00,35.00,'2026-01-23 15:15:00',NULL,'closed','2026-01-23 14:53:04','2026-01-23 15:15:25',50,'pending_payment'),(87,74,50.00,50.00,'2026-02-15 16:30:00',NULL,'closed','2026-02-15 15:03:48','2026-02-15 16:30:32',5,'pending_payment'),(89,76,370.00,380.00,'2026-02-16 23:45:00',18,'closed','2026-02-16 21:13:07','2026-02-19 20:52:54',5,'paid'),(90,77,45.00,80.00,'2026-02-16 22:43:00',12,'closed','2026-02-16 22:41:55','2026-02-16 23:22:13',5,'paid'),(93,80,9999.00,9999.00,'2026-02-18 15:20:00',NULL,'closed','2026-02-18 13:37:41','2026-02-18 19:50:44',50,NULL),(95,82,99.00,99.00,'2026-02-19 00:56:00',NULL,'closed','2026-02-19 00:26:36','2026-02-19 00:56:02',1,NULL),(96,79,300.00,580.00,'2026-02-28 04:25:00',16,'closed','2026-02-20 03:55:32','2026-02-28 22:23:08',35,'pending_payment'),(97,73,350.00,350.00,'2026-03-01 12:00:00',NULL,'closed','2026-03-01 00:23:00','2026-03-01 00:23:55',30,NULL);
/*!40000 ALTER TABLE `auctions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bids`
--

DROP TABLE IF EXISTS `bids`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bids` (
  `Bidid` int NOT NULL AUTO_INCREMENT,
  `auction_id` int NOT NULL,
  `user_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Bidid`),
  KEY `auction_id` (`auction_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `bids_ibfk_1` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`Aid`) ON DELETE CASCADE,
  CONSTRAINT `bids_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `customers` (`Cid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bids`
--

LOCK TABLES `bids` WRITE;
/*!40000 ALTER TABLE `bids` DISABLE KEYS */;
INSERT INTO `bids` VALUES (16,34,14,130.00,'2025-09-25 20:18:05'),(17,34,15,141.00,'2025-09-25 20:18:30'),(18,34,14,151.00,'2025-09-25 20:18:40'),(19,34,14,161.00,'2025-09-25 20:18:43'),(20,34,15,174.00,'2025-09-25 20:18:59'),(21,34,14,194.00,'2025-09-25 20:19:09'),(22,34,15,205.00,'2025-09-25 20:19:19'),(23,34,14,219.00,'2025-09-25 20:19:27'),(24,34,15,231.00,'2025-09-25 20:19:45'),(25,34,14,241.00,'2025-09-25 20:19:58'),(36,47,15,115.00,'2025-11-02 16:28:09'),(38,47,15,149.00,'2025-11-02 16:28:58'),(39,50,16,21.00,'2025-11-16 16:44:11'),(40,50,17,26.00,'2025-11-16 16:45:19'),(41,50,16,30.00,'2025-11-16 16:46:40'),(42,52,16,27.00,'2025-11-16 19:41:19'),(43,52,17,32.00,'2025-11-16 19:41:46'),(44,52,16,38.00,'2025-11-16 19:45:40'),(45,52,16,41.00,'2025-11-16 19:59:45'),(46,52,16,44.00,'2025-11-16 19:59:47'),(47,52,16,47.00,'2025-11-16 19:59:48'),(48,52,16,50.00,'2025-11-16 19:59:55'),(49,52,17,55.00,'2025-11-16 20:00:05'),(50,60,17,100.00,'2025-11-19 09:01:53'),(51,60,17,110.00,'2025-11-19 09:02:05'),(52,60,17,120.00,'2025-11-19 09:02:07'),(53,60,16,135.00,'2025-11-19 09:03:04'),(54,60,17,149.00,'2025-11-19 09:03:24'),(55,61,16,135.00,'2025-11-19 09:11:16'),(56,61,17,145.00,'2025-11-19 09:11:38'),(57,61,16,157.00,'2025-11-19 09:11:58'),(58,61,17,177.00,'2025-11-19 09:12:12'),(59,65,17,19.00,'2025-11-21 08:37:40'),(60,65,14,25.00,'2025-11-21 08:38:00'),(61,65,17,35.00,'2025-11-21 08:38:07'),(62,65,14,46.00,'2025-11-21 08:38:32'),(63,65,17,55.00,'2025-11-21 08:38:39'),(64,63,17,18.00,'2025-11-21 12:33:22'),(65,64,17,18.00,'2025-11-21 12:33:27'),(66,57,17,98.00,'2025-11-21 12:33:31'),(67,64,14,25.00,'2025-11-21 13:07:15'),(68,57,14,155.00,'2025-11-24 16:41:18'),(69,57,14,212.00,'2025-11-24 16:41:44'),(70,57,14,232.00,'2025-11-24 16:49:56'),(71,57,14,251.00,'2025-11-24 16:52:21'),(72,57,17,270.00,'2025-11-24 16:56:04'),(73,57,17,290.00,'2025-11-24 17:01:25'),(74,75,17,28.00,'2025-12-25 03:56:58'),(75,77,14,30.00,'2025-12-25 04:01:01'),(76,77,18,45.00,'2025-12-25 04:01:24'),(77,77,12,49.00,'2025-12-25 04:01:47'),(78,78,18,59.00,'2025-12-25 05:20:30'),(79,79,18,35.00,'2025-12-25 07:00:37'),(80,79,18,40.00,'2025-12-25 07:00:50'),(81,79,17,45.00,'2025-12-25 07:01:18'),(82,71,17,22.00,'2026-01-06 07:25:57'),(83,71,17,29.00,'2026-01-06 07:26:18'),(84,71,17,31.00,'2026-01-06 07:32:20'),(85,89,18,375.00,'2026-02-16 15:35:34'),(86,89,18,380.00,'2026-02-16 15:35:47'),(87,90,12,50.00,'2026-02-16 15:42:22'),(88,90,12,80.00,'2026-02-16 15:42:26'),(89,96,19,370.00,'2026-02-19 21:05:24'),(99,96,20,440.00,'2026-02-26 18:22:12'),(100,96,20,475.00,'2026-02-26 19:58:16'),(101,96,12,510.00,'2026-02-26 19:58:40'),(102,96,20,545.00,'2026-02-26 19:59:07'),(103,96,16,580.00,'2026-02-26 20:02:06');
/*!40000 ALTER TABLE `bids` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `Cid` int NOT NULL AUTO_INCREMENT,
  `Cname` varchar(255) DEFAULT NULL,
  `Caddress` varchar(255) DEFAULT NULL,
  `Cusername` varchar(50) DEFAULT NULL,
  `Cpassword` varchar(255) DEFAULT NULL,
  `Cphone` varchar(15) DEFAULT NULL,
  `Cstatus` varchar(50) DEFAULT NULL,
  `Cdate` date DEFAULT NULL,
  `Cprofile` varchar(255) DEFAULT NULL,
  `Cbirth` date DEFAULT NULL,
  `Csubdistrict` varchar(100) DEFAULT NULL,
  `Cdistrict` varchar(100) DEFAULT NULL,
  `Cprovince` varchar(100) DEFAULT NULL,
  `Czipcode` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`Cid`),
  UNIQUE KEY `uq_customers_phone` (`Cphone`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'Jane Smith','456 Elm Street, Townsville','janesmith456','pass456','555-5678','deleted','2023-07-20',NULL,'1985-10-20',NULL,NULL,NULL,NULL),(5,'จินดา วงศ์','33/8','lipid23','$2a$10$k4wP2G7Xw0tTkq1.n/ZVUeoyAQK.MG4S0SU5QP13PF4DXR0dXBWXK','0866658246','user',NULL,'1764362611322-328641988.jpg',NULL,'บ้านใหม่','ปากเกร็ด','นนทบุรี','11120'),(7,'นายนนกุล พิกุล','212','นนกุล2544','$2a$10$hf/P5lUwTsqu4jyGSFiUHO/SyIvxDCI0SCpPJpG6ObW/X4LkHQdMi','0915682497','user',NULL,NULL,NULL,'แพ้ว','บ้านย่า','กทม','11120'),(12,'นายทิวา วา','555','tiwa20','$2a$10$mmINYakbeu40UFQXRTDhf.mZMxyfprNe8AreKWur1STnE744M2AdK','0981111111','user','2025-06-17','1771356068320-893684588.jpg','2001-02-12','บ้านเขว้า','บ้านเขว้า','ชัยภูมิ','36170'),(14,'อังกะลุง มาเช่','222','polilo','$2a$10$faXZXxhRSZqHi3gAGZ0qp.EWWrd6rSGao67iIpiOu5wA4mFdrPNg6','0951245876','banned','2025-07-02','1764356003992-393154264.jpg','1999-09-21','ชะอำ','ชะอำ','เพชรบุรี','76120'),(15,'ทิวธวัฒน์ สสมอุ่มจาน','225','tiwwatad','$2a$10$yRW9oK4HjT5pBEc6F1EDW.P2CLC2Y/OyB7NtD1KR1KzBwrQ71QIQq','0869994758','banned','2025-07-02','1751493452090-851805195.jpg','2001-12-15','ปากเกร็ด','ปากเกร็ด','นนทบุรี','11120'),(16,'นายเอ แอ๊นมด','2','aaa@gmail.com','$2a$10$uyhB97ZaEWrMNC1JXdbe.OWXftWyXi6ohmla2pUeIjBn.VMWfjBgC','0986547511','user','2025-11-16','1763311216575-100982112.png','1983-11-11','บ้านเขว้า','บ้านเขว้า','ชัยภูมิ','36170'),(17,'นายบี เบิร์ด','5','Bbird','$2a$10$VIQDbxTDiSoX/mEQe.Lnz.9jx/xheNaEhpFxo7eXLDzPVvqI6crnO','0984561274','banned','2025-11-16','1763311332930-502375319.jpeg','2000-12-10','ท่าประดู่','เมืองระยอง','ระยอง','21000'),(18,'นางซี  แคทแมว','25','seecat','$2a$10$YWdFW8HTcJSCbBLAouXmQusIKSmIWS7h2HSt6D3Y0nzyzHrMEpiuW','0864447589','user','2025-12-22','1766408958124-913025263.jpg','2000-12-05','บ้านเขว้า','บ้านเขว้า','ชัยภูมิ','36170'),(19,'ดีด็อก  สุนัข','67/5','deedog','$2a$10$HU38EZL9uWRTzFT.IM1cZeB5.RlpStpwV9MlIq6y2G9Yg0jUhAu9G','0854565856','user','2026-02-15','1771146139107-960807439.jpg','1997-04-14','บ้านเขว้า','บ้านเขว้า','ชัยภูมิ','36170'),(20,'เอฟ ฟ๊อกกบอ๊บ','46/1','fff20','$2a$10$X6ZM4lObpX6kGzKqDwSgruTfr9H8iO8CRHCVH8rZ9DPgOYShCufAK','0869512587','user','2026-02-27','1772127783329-886178176.png','2000-02-15','บางหว้า','เขตภาษีเจริญ','กรุงเทพมหานคร','10160'),(22,'ดีด๊อก สุนัข','33','deedog22','$2a$10$QEITfJgZp9oUSrmep3aVoO3NtESzglJV3zHMpjCAb02dum2hitAQG','0864447585','user','2026-02-28','1772295981164-116631937.jpg','2026-02-11','ตลาด','พระประแดง','สมุทรปราการ','10130');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `favorites`
--

DROP TABLE IF EXISTS `favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `favorites`
--

LOCK TABLES `favorites` WRITE;
/*!40000 ALTER TABLE `favorites` DISABLE KEYS */;
INSERT INTO `favorites` VALUES (10,5,13,'2025-06-30 01:26:31'),(14,5,15,'2025-06-30 01:55:40'),(19,15,21,'2025-07-02 23:22:00'),(20,15,20,'2025-07-02 23:22:01'),(21,15,12,'2025-07-02 23:22:02'),(22,15,13,'2025-07-02 23:22:04'),(24,15,19,'2025-07-02 23:22:08'),(25,15,18,'2025-07-02 23:25:43'),(28,15,30,'2025-09-21 14:53:54'),(29,15,29,'2025-09-21 15:24:24'),(30,15,27,'2025-09-21 15:24:26'),(45,5,28,'2025-11-29 05:46:03'),(47,5,21,'2025-11-29 05:46:11'),(48,5,20,'2025-11-29 05:46:13'),(51,5,27,'2025-11-29 05:54:00'),(52,12,28,'2025-11-29 06:06:43'),(53,12,19,'2025-11-29 06:06:46'),(54,12,23,'2025-11-29 06:06:48'),(56,18,28,'2025-12-22 20:14:19'),(57,18,20,'2025-12-22 20:14:22'),(59,17,21,'2025-12-25 02:19:44'),(60,18,27,'2025-12-25 14:26:11'),(61,17,28,'2026-01-06 13:49:09'),(64,14,27,'2026-02-04 16:03:05'),(65,14,28,'2026-02-04 16:03:09'),(66,14,25,'2026-02-04 16:03:10');
/*!40000 ALTER TABLE `favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `Nid` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(200) NOT NULL,
  `body` varchar(500) DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Nid`),
  KEY `idx_customer` (`customer_id`,`is_read`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (10,20,'order_created','สร้างคำสั่งซื้อสำเร็จ','เลขที่คำสั่งซื้อ #89 ยอดรวม 105 บาท','/me/orders/89',1,'2026-02-27 02:17:42','2026-02-27 02:06:13'),(11,20,'order_cancelled','ยกเลิกคำสั่งซื้อแล้ว','คำสั่งซื้อ #88 ถูกยกเลิกเรียบร้อย','/me/orders/88',1,'2026-02-27 02:44:42','2026-02-27 02:15:27'),(12,20,'order_created','สร้างคำสั่งซื้อสำเร็จ','เลขที่คำสั่งซื้อ #90 ยอดรวม 185 บาท','/me/orders/90',1,'2026-02-27 02:44:42','2026-02-27 02:18:10'),(13,20,'order_created','สร้างคำสั่งซื้อสำเร็จ','เลขที่คำสั่งซื้อ #91 ยอดรวม 230 บาท','/me/orders/91',1,'2026-02-27 02:44:42','2026-02-27 02:24:10'),(14,20,'payment_uploaded','แนบสลิปสำเร็จ','คำสั่งซื้อ #91 ส่งสลิปแล้ว กำลังรอตรวจสอบ','/me/orders/91',1,'2026-02-27 02:44:42','2026-02-27 02:24:22'),(15,20,'order_created','สร้างคำสั่งซื้อสำเร็จ','เลขที่คำสั่งซื้อ #92 ยอดรวม 860 บาท','/me/orders/92',1,'2026-02-27 02:57:39','2026-02-27 02:45:08'),(16,20,'payment_uploaded','แนบสลิปสำเร็จ','คำสั่งซื้อ #92 ส่งสลิปแล้ว กำลังรอตรวจสอบ','/me/orders/92',1,'2026-02-27 02:57:39','2026-02-27 02:45:22'),(17,20,'payment_approved','ชำระเงินสำเร็จ','คำสั่งซื้อ #92 ได้รับการยืนยันการชำระเงินแล้ว','/me/orders/92',1,'2026-02-27 02:57:39','2026-02-27 02:46:53'),(18,20,'auction_outbid','มีคนแซงบิดแล้ว','ประมูล #96 มีราคาสูงกว่าแล้ว ตอนนี้อยู่ที่ 510 บาท','/auctions/96',1,'2026-02-27 02:59:05','2026-02-27 02:58:40'),(19,12,'auction_outbid','มีคนแซงบิดแล้ว','ประมูล #96 มีราคาสูงกว่าแล้ว ตอนนี้อยู่ที่ 545 บาท','/auctions/96',0,NULL,'2026-02-27 02:59:07'),(20,20,'auction_outbid','มีคนแซงบิดแล้ว','ประมูล #96 มีราคาสูงกว่าแล้ว ตอนนี้อยู่ที่ 580 บาท','/auctions/96',1,'2026-03-01 00:00:48','2026-02-27 03:02:06'),(21,16,'auction_won','คุณชนะประมูล','คุณชนะประมูล #96 ยอดชนะ 580 บาท กรุณาชำระภายใน 24 ชั่วโมง','/me/auction-wins/96',0,NULL,'2026-02-28 22:23:08'),(22,19,'auction_lost','ประมูลจบแล้ว','ประมูล #96 จบแล้ว คุณไม่ได้เป็นผู้ชนะ รอบหน้าลองสู้ใหม่ได้','/auctions/96',0,NULL,'2026-02-28 22:23:08'),(23,20,'auction_lost','ประมูลจบแล้ว','ประมูล #96 จบแล้ว คุณไม่ได้เป็นผู้ชนะ รอบหน้าลองสู้ใหม่ได้','/auctions/96',1,'2026-03-01 00:00:44','2026-02-28 22:23:08'),(24,12,'auction_lost','ประมูลจบแล้ว','ประมูล #96 จบแล้ว คุณไม่ได้เป็นผู้ชนะ รอบหน้าลองสู้ใหม่ได้','/auctions/96',0,NULL,'2026-02-28 22:23:08'),(25,20,'order_created','สร้างคำสั่งซื้อสำเร็จ','เลขที่คำสั่งซื้อ #93 ยอดรวม 95 บาท','/me/orders/93',1,'2026-03-01 00:01:55','2026-03-01 00:01:31');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=174 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
INSERT INTO `order_items` VALUES (69,27,13,2,45.00),(70,27,15,2,56.50),(71,28,21,1,65.00),(72,28,13,2,45.00),(73,28,18,1,65.00),(74,29,15,1,56.50),(75,29,13,2,45.00),(76,30,13,3,45.00),(77,30,18,3,65.00),(78,30,19,1,75.00),(79,31,13,2,45.00),(80,31,18,1,65.00),(81,32,15,2,56.50),(82,32,21,7,65.00),(83,33,18,1,65.00),(84,33,19,3,75.00),(85,34,18,1,65.00),(86,35,15,4,56.50),(87,35,18,11,65.00),(88,35,19,1,75.00),(89,36,13,1,45.00),(90,37,13,1,45.00),(91,38,15,1,56.50),(92,39,15,1,56.50),(93,40,15,4,56.50),(94,40,19,1,75.00),(95,41,18,4,65.00),(96,41,13,1,45.00),(97,41,21,1,65.00),(98,42,13,4,45.00),(99,42,15,1,56.50),(101,42,20,1,55.00),(102,42,18,1,65.00),(103,42,21,1,65.00),(104,43,15,1,56.50),(105,44,28,1,65.00),(106,45,29,1,85.00),(107,46,29,1,85.00),(108,47,27,1,45.00),(109,48,30,2,56.50),(110,48,29,1,85.00),(111,49,28,2,65.00),(112,49,27,1,45.00),(113,49,29,1,85.00),(114,50,27,1,45.00),(115,50,28,2,65.00),(116,50,29,1,85.00),(117,50,30,1,56.50),(118,51,28,2,65.00),(119,51,20,1,55.00),(120,52,28,1,65.00),(121,53,29,2,85.00),(122,53,20,1,55.00),(123,53,19,2,75.00),(124,54,24,2,45.00),(125,54,27,1,45.00),(126,54,28,1,65.00),(127,54,29,1,85.00),(128,54,25,2,55.50),(129,55,19,16,75.00),(130,56,25,1,55.50),(131,57,27,1,45.00),(132,58,25,3,55.50),(133,59,20,19,55.00),(134,60,28,2,65.00),(135,61,27,1,45.00),(136,62,30,3,56.50),(137,63,28,2,65.00),(138,63,25,3,55.50),(139,64,30,3,56.50),(140,65,30,1,56.50),(141,66,28,3,65.00),(142,67,27,3,45.00),(143,67,25,8,55.50),(144,68,30,6,56.50),(145,69,28,1,65.00),(146,69,25,7,55.50),(147,69,23,9,65.00),(148,70,28,4,65.00),(149,70,20,30,55.00),(150,71,21,15,65.00),(151,72,30,6,56.50),(152,73,13,1,45.00),(153,74,25,1,55.50),(154,75,24,15,45.00),(155,76,25,3,55.50),(156,77,31,4,29.00),(157,78,31,1,29.00),(158,79,28,1,65.00),(159,79,27,1,45.00),(160,80,28,1,65.00),(161,81,24,2,45.00),(162,82,27,1,45.00),(163,83,27,1,45.00),(164,84,30,1,56.50),(165,85,30,1,56.50),(166,86,27,1,45.00),(167,87,20,1,55.00),(168,88,20,1,55.00),(169,89,20,1,55.00),(170,90,24,3,45.00),(171,91,13,4,45.00),(172,92,24,18,45.00),(173,93,27,1,45.00);
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `Oid` int NOT NULL AUTO_INCREMENT,
  `Oprice` decimal(10,2) DEFAULT NULL,
  `Odate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Ostatus` varchar(50) DEFAULT NULL,
  `Cid` int DEFAULT NULL,
  `Oslip` varchar(255) DEFAULT NULL,
  `Opayment` varchar(20) DEFAULT 'transfer',
  `Otracking` varchar(50) DEFAULT NULL,
  `Oshipping` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Oid`)
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,450.00,'2025-06-19 00:00:00','cancelled',1,NULL,'transfer',NULL,NULL),(2,450.00,'2025-06-19 00:00:00','cancelled',1,NULL,'transfer',NULL,NULL),(3,450.00,'2025-06-19 00:00:00','cancelled',1,NULL,'transfer',NULL,NULL),(4,450.00,'2025-06-19 00:00:00','cancelled',1,NULL,'transfer',NULL,NULL),(5,450.00,'2025-06-19 00:00:00','cancelled',12,NULL,'transfer',NULL,NULL),(6,750.00,'2025-06-19 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(7,320.00,'2025-06-19 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(8,380.00,'2025-06-19 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(9,240.00,'2025-06-19 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(10,520.00,'2025-06-19 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(11,570.00,'2025-06-20 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(12,330.00,'2025-06-20 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(13,450.00,'2025-06-20 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(14,430.00,'2025-06-20 00:00:00','payment_review',5,NULL,'transfer',NULL,NULL),(15,200.00,'2025-06-21 00:00:00','payment_review',5,NULL,'transfer',NULL,NULL),(16,660.00,'2025-06-21 00:00:00','payment_review',5,NULL,'transfer',NULL,NULL),(17,510.00,'2025-06-21 00:00:00','payment_review',5,NULL,'transfer',NULL,NULL),(18,740.00,'2025-06-21 00:00:00','payment_review',5,'http://localhost:3000/uploads/test-slip.jpg','transfer',NULL,NULL),(19,70.00,'2025-06-21 00:00:00','payment_review',5,NULL,'transfer',NULL,NULL),(20,260.00,'2025-06-21 00:00:00','payment_review',5,'/slips/1750542455448-188087695.jpg','transfer',NULL,NULL),(21,310.00,'2025-06-21 00:00:00','payment_review',5,'/slips/1750543092104-495853990.png','transfer',NULL,NULL),(22,50.00,'2025-06-21 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(23,530.00,'2025-06-21 00:00:00','payment_review',5,'/slips/1750544595253-881636319.jpg','transfer',NULL,NULL),(24,50.00,'2025-06-21 00:00:00','shipping',5,'/slips/1750545709186-411671142.jpg','transfer',NULL,NULL),(25,600.00,'2025-06-21 00:00:00','cancelled',5,'/slips/1750546874037-145015920.jpg','transfer',NULL,NULL),(26,310.00,'2025-06-24 00:00:00','refunded',5,'/slips/1750798364992-334244721.jpg','transfer',NULL,NULL),(27,203.00,'2025-06-25 00:00:00','paid',5,'/slips/1750814542759-390508319.png','transfer',NULL,NULL),(28,220.00,'2025-06-27 00:00:00','cancelled',5,NULL,NULL,NULL,NULL),(29,146.50,'2025-06-27 00:00:00','cancelled',5,NULL,'transfer',NULL,NULL),(30,405.00,'2025-06-27 00:00:00','shipping',5,NULL,'cod',NULL,NULL),(31,155.00,'2025-06-27 00:00:00','shipping',5,NULL,'cod',NULL,NULL),(32,568.00,'2025-06-29 00:00:00','shipping',5,NULL,'cod',NULL,NULL),(33,290.00,'2025-06-29 00:00:00','delivered',5,'/slips/1751237875638-577669543.jpg','transfer',NULL,NULL),(34,65.00,'2025-06-30 00:00:00','delivered',5,NULL,'cod',NULL,NULL),(35,1016.00,'2025-07-02 00:00:00','payment_review',15,'/slips/1751496516970-660939988.png','transfer',NULL,NULL),(36,45.00,'2025-07-02 00:00:00','paid',15,'/slips/1751496602199-936882596.png','transfer',NULL,NULL),(37,45.00,'2025-07-02 00:00:00','shipping',15,NULL,'cod',NULL,NULL),(38,56.50,'2025-07-02 00:00:00','cancelled',15,NULL,'transfer',NULL,NULL),(39,56.50,'2025-07-02 00:00:00','cancelled',15,NULL,'transfer',NULL,NULL),(40,301.00,'2025-07-02 00:00:00','cancelled',15,NULL,'transfer',NULL,NULL),(41,370.00,'2025-07-02 00:00:00','cancelled',15,NULL,'transfer',NULL,NULL),(42,506.50,'2025-07-02 00:00:00','paid',15,'/slips/1751497819073-156330693.png','transfer',NULL,NULL),(43,106.50,'2025-07-02 00:00:00','paid',15,'/slips/1751497869386-562504404.png','transfer',NULL,NULL),(44,115.00,'2025-09-21 00:00:00','shipping',15,NULL,'cod',NULL,NULL),(45,135.00,'2025-10-21 00:00:00','paid',14,'/slips/1761051143383-751088480.jpg','transfer',NULL,NULL),(46,135.00,'2025-11-18 00:00:00','delivered',17,'/slips/1763402292920-946249335.jpg','transfer',NULL,NULL),(47,95.00,'2025-11-18 00:00:00','paid',17,NULL,'transfer',NULL,NULL),(48,248.00,'2025-11-19 00:00:00','paid',14,'/slips/1763556957709-178771830.jpg','transfer',NULL,NULL),(49,310.00,'2025-11-19 00:00:00','shipping',14,NULL,'cod',NULL,NULL),(50,366.50,'2025-11-19 00:00:00','delivered',14,NULL,'cod','TH123546872TH','ไปรษณีย์ไทย'),(51,235.00,'2025-11-19 00:00:00','delivered',14,NULL,'cod','JT1234567890XX','J&T'),(52,115.00,'2025-11-22 00:00:00','payment_review',17,NULL,'transfer',NULL,NULL),(53,425.00,'2025-11-22 02:31:45','paid',14,'/slips/1763753515167-43550776.jpg','transfer',NULL,NULL),(54,446.00,'2025-11-22 02:33:38','delivered',14,'/slips/1763753660071-324817685.jpeg','transfer','TH0107KLMN902C','Flash'),(55,1200.00,'2025-11-22 02:41:51','paid',14,'/slips/1763754121332-527441094.jpg','transfer',NULL,NULL),(56,105.50,'2025-11-26 03:24:37','paid',12,'/slips/1764102295612-327932618.jpeg','transfer',NULL,NULL),(57,95.00,'2025-11-26 03:46:11','paid',12,'/slips/1764103608389-272177743.jpg','transfer',NULL,NULL),(58,216.50,'2025-11-30 03:22:04','delivered',17,'/slips/1764447738378-331771604.jpg','transfer',NULL,NULL),(59,1045.00,'2025-11-30 03:34:11','delivered',17,'/slips/1764448461723-173746574.jpg','transfer','TH0107KLMN901C','Flash'),(60,180.00,'2025-12-22 20:18:46','delivered',18,'/slips/1766409572443-332460508.jpg','transfer','JT1234567890TH','J&T'),(61,95.00,'2025-12-23 15:52:17','delivered',18,NULL,'cod',NULL,NULL),(62,219.50,'2025-12-24 17:19:52','cancelled',14,NULL,'transfer',NULL,NULL),(63,346.50,'2025-12-25 02:51:50','paid',17,'/slips/1766605943633-938985908.png','transfer',NULL,NULL),(64,219.50,'2025-12-25 02:57:35','delivered',17,'/slips/1766606577471-954091745.png','transfer','TH1234567888','Flash'),(65,106.50,'2025-12-25 10:58:10','delivered',17,NULL,'cod','TH12305378TH','J&T'),(66,245.00,'2026-01-23 14:53:59','delivered',17,'/slips/1769154853475-946765187.png','transfer','JT12564525Th','J&T'),(67,629.00,'2026-02-03 15:54:56','cancelled',14,'/slips/1770108940817-887040261.png','transfer',NULL,NULL),(68,389.00,'2026-02-03 22:20:09','waiting',5,NULL,'transfer',NULL,NULL),(69,1038.50,'2026-02-03 22:24:41','delivered',5,NULL,'cod','JT255454455','J&T'),(70,1910.00,'2026-02-15 22:15:57','delivered',19,'/slips/1771168603123-922067697.jpg','transfer','JT152455225','J&T'),(71,1025.00,'2026-02-15 22:25:33','waiting',19,NULL,'transfer',NULL,NULL),(72,389.00,'2026-02-15 22:28:47','cancelled',19,NULL,'transfer',NULL,NULL),(73,95.00,'2026-02-15 23:11:22','cancelled',19,NULL,'transfer',NULL,NULL),(74,105.50,'2026-02-16 20:52:02','pending_payment',5,NULL,'transfer',NULL,NULL),(75,725.00,'2026-02-16 22:36:12','paid',18,'/slips/1771256184907-863946854.jpg','transfer',NULL,NULL),(76,216.50,'2026-02-16 22:37:01','pending_payment',5,NULL,'cod',NULL,NULL),(77,166.00,'2026-02-18 13:52:03','delivered',12,NULL,'cod','TH555748522','Kerry'),(78,79.00,'2026-02-20 00:41:01','pending_payment',12,NULL,'cod',NULL,NULL),(79,160.00,'2026-02-20 02:58:19','pending_payment',12,NULL,'cod',NULL,NULL),(80,115.00,'2026-02-20 03:03:10','payment_review',12,'/slips/1771531562228-397809632.png','transfer',NULL,NULL),(81,140.00,'2026-02-27 01:41:03','pending_payment',20,NULL,'transfer',NULL,NULL),(82,95.00,'2026-02-27 01:45:58','pending_payment',20,NULL,'transfer',NULL,NULL),(83,95.00,'2026-02-27 01:48:24','pending_payment',20,NULL,'transfer',NULL,NULL),(84,106.50,'2026-02-27 01:56:38','pending_payment',20,NULL,'transfer',NULL,NULL),(85,106.50,'2026-02-27 01:57:43','pending_payment',20,NULL,'transfer',NULL,NULL),(86,95.00,'2026-02-27 02:00:33','pending_payment',20,NULL,'transfer',NULL,NULL),(87,105.00,'2026-02-27 02:01:50','pending_payment',20,NULL,'transfer',NULL,NULL),(88,105.00,'2026-02-27 02:03:38','cancelled',20,NULL,'transfer',NULL,NULL),(89,105.00,'2026-02-27 02:06:13','payment_review',20,'/slips/1772132785132-716398857.png','transfer',NULL,NULL),(90,185.00,'2026-02-27 02:18:10','payment_review',20,'/slips/1772133500633-368447525.png','transfer',NULL,NULL),(91,230.00,'2026-02-27 02:24:10','payment_review',20,'/slips/1772133862387-747225767.jpg','transfer',NULL,NULL),(92,860.00,'2026-02-27 02:45:08','paid',20,'/slips/1772135122696-898069252.jpg','transfer',NULL,NULL),(93,95.00,'2026-03-01 00:01:31','pending_payment',20,NULL,'cod',NULL,NULL);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `Payid` int NOT NULL AUTO_INCREMENT,
  `Oid` int NOT NULL,
  `Payprice` decimal(10,2) DEFAULT NULL,
  `Paydate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Paystatus` varchar(50) DEFAULT 'waiting',
  `SlipUrl` text,
  `Tid` int DEFAULT NULL,
  PRIMARY KEY (`Payid`),
  KEY `Oid` (`Oid`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`Oid`) REFERENCES `orders` (`Oid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,4,450.00,'2025-06-19 23:30:33','waiting','/slips/1750375833640-248522693.jpg',NULL),(2,10,520.00,'2025-06-19 23:45:29','waiting','/slips/1750376729849-982801340.jpg',NULL),(3,11,570.00,'2025-06-20 00:12:16','waiting','/slips/1750378336062-718549742.jpg',NULL),(4,12,330.00,'2025-06-20 00:16:00','waiting','/slips/1750378560444-919985367.jpg',NULL),(5,13,450.00,'2025-06-20 00:35:59','waiting','/slips/1750379759547-86134413.jpg',NULL),(6,14,430.00,'2025-06-20 00:42:24','waiting','/slips/1750380144481-143919309.jpg',NULL),(7,15,200.00,'2025-06-21 21:01:28','waiting','/slips/1750539688784-724215328.png',NULL),(8,16,660.00,'2025-06-21 21:12:19','waiting','/slips/1750540339854-255459634.png',NULL),(9,17,510.00,'2025-06-21 21:15:01','waiting','/slips/1750540501571-816619128.jpg',NULL),(10,18,740.00,'2025-06-21 21:25:08','waiting','/slips/1750541108331-786407796.png',NULL),(11,19,70.00,'2025-06-21 21:35:19','waiting','/slips/1750541719362-673317622.jpg',NULL),(12,20,260.00,'2025-06-21 21:47:35','waiting','/slips/1750542455448-188087695.jpg',NULL),(13,21,310.00,'2025-06-21 21:58:12','waiting','/slips/1750543092104-495853990.png',NULL),(14,23,530.00,'2025-06-21 22:23:15','waiting','/slips/1750544595253-881636319.jpg',NULL),(15,24,50.00,'2025-06-21 22:41:49','waiting','/slips/1750545709186-411671142.jpg',2),(16,25,600.00,'2025-06-21 23:01:14','waiting','/slips/1750546874037-145015920.jpg',1),(17,26,310.00,'2025-06-24 20:52:45','waiting','/slips/1750798364992-334244721.jpg',2),(18,27,203.00,'2025-06-25 01:22:22','waiting','/slips/1750814542759-390508319.png',1),(19,33,290.00,'2025-06-29 22:57:55','waiting','/slips/1751237875638-577669543.jpg',1),(20,35,1016.00,'2025-07-02 22:48:37','waiting','/slips/1751496516970-660939988.png',2),(21,36,45.00,'2025-07-02 22:50:02','waiting','/slips/1751496602199-936882596.png',2),(22,42,506.50,'2025-07-02 23:10:19','waiting','/slips/1751497819073-156330693.png',2),(23,43,106.50,'2025-07-02 23:11:09','waiting','/slips/1751497869386-562504404.png',1),(24,45,135.00,'2025-10-21 19:52:23','waiting','/slips/1761051143383-751088480.jpg',2),(25,46,135.00,'2025-11-18 00:56:27','waiting','/slips/1763402187278-620507179.jpg',2),(26,46,135.00,'2025-11-18 00:58:12','waiting','/slips/1763402292920-946249335.jpg',1),(27,48,248.00,'2025-11-19 19:55:57','waiting','/slips/1763556957709-178771830.jpg',2),(28,52,115.00,'2025-11-22 01:21:08','waiting','/slips/1763749268408-380195902.png',1),(29,53,425.00,'2025-11-22 02:31:55','waiting','/slips/1763753515167-43550776.jpg',2),(30,54,446.00,'2025-11-22 02:34:20','waiting','/slips/1763753660071-324817685.jpeg',2),(31,55,1200.00,'2025-11-22 02:42:01','waiting','/slips/1763754121332-527441094.jpg',2),(32,56,105.50,'2025-11-26 03:24:55','pending','/slips/1764102295612-327932618.jpeg',1),(33,57,95.00,'2025-11-26 03:46:48','pending','/slips/1764103608389-272177743.jpg',2),(34,58,216.50,'2025-11-30 03:22:18','pending','/slips/1764447738378-331771604.jpg',2),(35,59,1045.00,'2025-11-30 03:34:21','pending','/slips/1764448461723-173746574.jpg',2),(36,60,180.00,'2025-12-22 20:19:32','pending','/slips/1766409572443-332460508.jpg',2),(37,63,346.50,'2025-12-25 02:52:23','pending','/slips/1766605943633-938985908.png',1),(38,64,219.50,'2025-12-25 03:02:57','pending','/slips/1766606577471-954091745.png',1),(39,66,245.00,'2026-01-23 14:54:13','pending','/slips/1769154853475-946765187.png',1),(40,67,629.00,'2026-02-03 15:55:40','pending','/slips/1770108940817-887040261.png',2),(41,68,389.00,'2026-02-03 22:20:50','pending','/slips/1770132050035-867326273.png',2),(42,70,1910.00,'2026-02-15 22:16:43','pending','/slips/1771168603123-922067697.jpg',2),(43,75,725.00,'2026-02-16 22:36:24','pending','/slips/1771256184907-863946854.jpg',1),(44,80,115.00,'2026-02-20 03:06:02','pending','/slips/1771531562228-397809632.png',2),(45,89,105.00,'2026-02-27 02:06:25','pending','/slips/1772132785132-716398857.png',1),(46,90,185.00,'2026-02-27 02:18:20','pending','/slips/1772133500633-368447525.png',2),(47,91,230.00,'2026-02-27 02:24:22','pending','/slips/1772133862387-747225767.jpg',1),(48,92,860.00,'2026-02-27 02:45:22','pending','/slips/1772135122696-898069252.jpg',2);
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_types`
--

DROP TABLE IF EXISTS `product_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_types` (
  `Typeid` int NOT NULL AUTO_INCREMENT,
  `typenproduct` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Typeid`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_types`
--

LOCK TABLES `product_types` WRITE;
/*!40000 ALTER TABLE `product_types` DISABLE KEYS */;
INSERT INTO `product_types` VALUES (1,'แคคตัสหนามสั้น'),(2,'แคคตัสหนามยาว'),(3,'ไม้อวบน้ำ'),(4,'ของตกแต่งกระถาง');
/*!40000 ALTER TABLE `product_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `Pid` int NOT NULL AUTO_INCREMENT,
  `Pname` varchar(255) DEFAULT NULL,
  `Pprice` decimal(10,2) DEFAULT NULL,
  `Pnumproduct` int DEFAULT NULL,
  `Prenume` int DEFAULT NULL,
  `Pstatus` varchar(50) DEFAULT NULL,
  `Ppicture` varchar(255) DEFAULT NULL,
  `Pdetail` text,
  `Typeid` int DEFAULT NULL,
  `Subtypeid` int DEFAULT NULL,
  PRIMARY KEY (`Pid`),
  KEY `fk_typeid` (`Typeid`),
  CONSTRAINT `fk_typeid` FOREIGN KEY (`Typeid`) REFERENCES `product_types` (`Typeid`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (13,'แมมมิลลาเรีย พลูโมซา (แมมขนนก)',45.00,49,1,'In stock','/products/1750809952095-571706861.png','แมมมิลลาเรีย พลูโมซา หรือที่รู้จักในชื่อ แมมขนนก (Feather Cactus) มีชื่อวิทยาศาสตร์ว่า Mammillaria Plumosa F.A.C.Weber ต้นกำเนิดมาจากแถบอเมริกากลาง ลักษณะลำต้นเป็นทรงกลม มีพูแต่มองเห็นไม่ชัด มีหนามอ่อนสีขาวอ่อนรอบต้นคล้ายพู่ขนนก ดอกมีสีขาวอมเหลืองหรือสีชมพู มักออกดอกช่วงฤดูหนาว นิยมขยายพันธุ์ด้วยการเพาะเมล็ดและปักชำ ชอบดินร่วนปนทราย ชอบน้ำน้อยถึงปานกลาง ชอบแสงแดด และทนแล้งได้ดี',1,3),(15,'แมมมิลลาเรีย เพอร์เบลลา (แมมนกฮูก)',56.50,38,0,'In stock','/products/1750813644181-619194447.png','แมมมิลลาเรีย เพอร์เบลลา หรือเรียกสั้น ๆ ว่า แมมนกฮูก (Owl Eye Cactus) มีชื่อวิทยาศาสตร์ว่า Mammillaria Perbella Hildmann ex K. Schumann มีต้นกำเนิดมาจากประเทศเม็กซิโก ลำต้นทรงกลมมน หนามสั้นสีขาว เรียงตัวเป็นระเบียบ มองดูสวยงาม เมื่อโตขึ้นจะแตกหน่อเป็น 2 ยอดลักษณะคล้ายตานกฮูก มีดอกสีชมพูอมม่วง เมื่อออกดอกพร้อมกันจะเรียงตัวรอบ ๆ ต้นลักษณะคล้ายมงกุฎ นิยมขยายพันธุ์ด้วยการเพาะเมล็ดและตัดกิ่ง ชอบดินที่อุดมไปด้วยแร่ธาตุและระบายน้ำดี ชอบแสงแดดจัดเต็มวัน ทนแล้งได้ดี ไม่ต้องการน้ำมาก บำรุงด้วยปุ๋ยที่มีโพแทสเซียมสูงในช่วงฤดูร้อน',1,3),(18,'ตะบองผู้เฒ่า (แมมพ่อเฒ่า)',65.00,35,0,'In stock','/products/1750970119607-222220298.png','ตะบองพ่อเฒ่า หรือ แมมพ่อเฒ่า (Old Man Cactus) มีชื่อวิทยาศาสตร์ว่า Cephalocereus Senilis (Haw.) Pfeiff. ต้นกำเนิดมาจากประเทศเม็กซิโก เป็นไม้อวบน้ำอายุหลายปี อาจสูงได้ถึง 15 เมตร ลำต้นเป็นทรงกระบอก มี 20-30 พู สีเขียวเข้มสวย มีขนสีขาวและหนามกลางสีเหลืองอ่อนปกคลุมทั่วลำต้น มีดอกไม้สีขาวอมชมพู แต่ออกดอกยาก ส่วนใหญ่นิยมขยายพันธุ์ด้วยเพาะเมล็ด มักจะปลูกเป็นไม้กระถางในอาคาร ชอบดินร่วนปนทราย ชอบน้ำน้อย และชอบแสงแดดจัด',3,21),(19,'ถังทอง',75.00,47,18,'In stock','/products/1750970256295-503485795.png','ถังทอง (Golden Barrel Cactus) มีชื่อวิทยาศาสตร์ว่า Echinocactus Grusonii Hildm. ต้นกำเนิดจากเม็กซิโกและอเมริกากลาง ลำต้นลักษณะกึ่งทรงกลมแป้น สีเขียวอ่อนถึงสีเขียวเข้ม ปกคลุมด้วยหนามสีขาวอมเหลือง ลักษณะแตกออกเป็นรัศมี เมื่อต้นโตส่วนบนสุดของลำต้นจะเว้าลงมาคล้ายปากถัง และออกดอกบริเวณยอดของลำต้นสีเหลืองทอง ส่วนใหญ่นิยมขยายพันธุ์ด้วยการเพาะเมล็ด เหมาะสำหรับปลูกในดินร่วนปนทราย ระบายน้ำได้ดี ชอบน้ำปานกลาง และชอบแสงแดดจัด ทนแล้งได้ดี',2,14),(20,'เรนโบว์',55.00,50,50,'In stock','/products/1750973947272-454292363.png,/products/1750973951723-799874942.jpg','เรนโบว์ (Rainbow Hedgehog Cactus) มีชื่อวิทยาศาสตร์ว่า Echinocereus rigidissimus (Engelm.) Rose ต้นกำเนิดมาจากประเทศสหรัฐอเมริกาและเม็กซิโก ลักษณะลำต้นทรงกระบอก เมื่อโตจะมีความสูงประมาณ 6-20 เซนติเมตร หนามราบไปกับลำต้น มีจุดเด่นอยู่ที่หนามสีแดง-ชมพูเข้มไล่เฉดสีคล้ายรุ้ง ส่วนดอกออกสีชมพูสดที่ปลายยอด บานช่วงพฤษภาคม-กรกฎาคม นิยมขยายพันธุ์ด้วยการเพาะเมล็ด โตช้า ชอบดินที่ระบายน้ำดีและมีความเป็นกรดเล็กน้อย ชอบแสงแดดจ้า ต้องการน้ำเล็กน้อย ลดการให้น้ำช่วงหน้าฝน พร้อมระวังน้ำขังเพราะอาจจะทำให้รากเน่าได้ง่ายด้วย',1,7),(21,'คลื่นสมอง',65.00,55,0,'In stock','/products/1750974205589-756886561.png,/products/1750974210400-186454624.jpg','คลื่นสมอง มีชื่อวิทยาศาสตร์ว่า Echinofossulocactus Phyllacanthus Lawr. in Loudon ต้นกำเนิดมาจากประเทศเม็กซิโก ลำต้นค่อนข้างกลม พูหยักคล้ายสมอง มีตุ่มหนามประมาณ 1-3 ตุ่มในแต่ละพู และหนามยาวสีขาว-น้ำตาลเกือบทั่วลำต้น ไม่แตกหน่อ ส่วนดอกเป็นทรงกรวยขนาดเล็ก สีชมพูอมขาว ออกตรงกลางยอด บานช่วงฤดูร้อน นิยมขยายพันธุ์ด้วยการเพาะเมล็ด ชอบดินทั่วไปที่ระบายน้ำดี ชอบแสงแดดจัด ทนร้อน ทนแล้งได้ดี แต่ไม่ทนความเย็น ต้องการน้ำไม่มาก ให้รดตอนดินแห้ง ',2,15),(23,'เทอร์บินิคาร์ปัส',65.00,15,0,'In stock','/products/1751728564142-861913548.png','เทอร์บินิคาร์ปัส มีชื่อวิทยาศาสตร์ว่า Turbinicarpus Krainzianus Var. Minimus เป็นต้นไม้ปลูกง่าย ขนาดเล็ก มีหัวใต้ดิน ลำต้นสีเขียวเข้ม ขึ้นเป็นกอ ปกคลุมด้วยหนามสีขาว มีดอกสีครีมขึ้นปลายยอดสีเหลืองครีมและสีเขียวอ่อน นิยมขยายพันธุ์ด้วยการเพาะเมล็ด ชอบดินร่วนระบายน้ำได้ดี ชอบน้ำ และชอบแสงแดดจัด ทนแล้งได้ดี',1,26),(24,'คามิเน่ แดง',45.00,65,35,'In stock','/products/1751728845031-91049207.png','คามิเน่ แดง มีชื่อวิทยาศาสตร์ว่า Mammillaria Carmenae f. rubrispina hort. ต้นกำเนิดมาจากเนเธอร์แลนด์ ลักษณะลำต้นทรงกระบอก ขนอ่อนสีทอง-แดง ขึ้นเป็นกระจุก ปลายหนามกระจายเป็นแฉก ส่วนดอกมีตั้งแต่สีขาวครีม ชมพู และชมพูอ่อน มักขึ้นเรียงรอบยอดต้นคล้ายมงกุฎ ขยายพันธุ์ด้วยการแบ่งแยกส่วนและเพาะเมล็ด ชอบดินที่ระบายน้ำดี ชอบแสงแดดจัด ควรรดน้ำในหน้าร้อนอย่างสม่ำเสมอ แต่ระวังอย่าให้แฉะ เพราะจะทำให้รากเน่าได้',2,17),(25,'แมมมิลาเรีย อีลองกาต้า (แมมนิ้วทอง)',55.50,33,12,'In stock','/products/1751729119471-207301634.png','แมมมิลาเรีย อีลองกาต้า หรือแมมนิ้วทอง (Ladyfinger Cactus, Gold Lace Cactus) มีชื่อวิทยาศาสตร์ว่า Mammillaria Elongata DC. เป็นพืชท้องถิ่นของเม็กซิโก ลักษณะลำต้นตั้งตรงสีเขียวอ่อน แตกหน่อจากตุ่มหนาม มีหนามขนาดเล็ก โคนสีเหลือง ปลายสีแดง ส่วนดอกเป็นดอกเดี่ยวสีขาว ขนาดเล็ก ออกตามซอกตุ่มหนาม นิยมขยายพันธุ์ด้วยการเพาะเมล็ดและปักชำหน่อ ชอบดินร่วนปนทรายที่ระบายน้ำดี ชอบน้ำปานกลาง-น้อย และชอบแสงแดดจัด ๆ ทนแล้งได้ดี',1,3),(27,'เฟอโรคัตตัส หนามแดง',45.00,11,5,'In stock','/products/1751738236052-475535476.jpeg','เฟอโรคัตตัส หนามแดง เป็นชื่อเรียกของกระบองเพชรในสกุล Ferocactus ที่มีหนามสีแดง โดยทั่วไปแล้วหมายถึงสายพันธุ์ Ferocactus pilosus หรือ Ferocactus peninsulae. ลักษณะเด่นคือหนามสีแดงสดที่แหลมคมและแข็งแรง. \n',2,14),(28,'อิชิโนแคคตัส หนามขาว',65.00,5,20,'In stock','/products/1751738410439-733208181.jpeg',' Echinocactus grusonii var. albispinus Y.Ito\n\nเป็นหนึ่งในกระบองเพชรสายพันธุ์อิชินอปซิส ที่เหล่าผู้เลี้ยงกระบองเพชรรู้จักกันดีนั่นเอง หากจะถามว่าเจ้าถังเงิน แตกต่างจากเจ้าถังทองอย่างไร?\n\nก็แทบจะไม่มีสิ่งเหล่านั้นเลย เพราะกระบองเพชรถังเงินก็คือ กระบองเพชรถังทองแบบที่หนามเป็นสีขาวเท่านั้นเอง\n\nใครที่ชอบกระบองเพชรแนวถังทองอยู่แล้ว แต่อยากเปลี่ยนสี เปลี่ยนบรรยากาศ หรือเลี้ยงคู่กันให้เป็นมงคลก็ดีไม่หยอก',2,15),(29,'ออริโอเซเรอุส ตาแก่แห่งแอนดีส',85.00,0,6,'Out of stock','/products/1751738573934-534856261.jpeg','ออริโอเซเรอุส แคคตัส (Aриоเซเรอุส) เป็นสกุลของกระบองเพชรที่ขึ้นชื่อเรื่องลักษณะที่คล้ายหินและเติบโตช้า มักมีลำต้นกลมแบน มีหนามเล็กๆ หรือไม่มีเลย ส่วนใหญ่พบในเม็กซิโกและสหรัฐอเมริกา \nลักษณะทั่วไปของออริโอเซเรอุส แคคตัส:\nรูปร่าง:\nลำต้นมีลักษณะกลมแบน หรือเป็นทรงกระบอกสั้นๆ \nหนาม:\nโดยทั่วไปมีหนามน้อย หรือไม่มีเลย หนามที่พบส่วนใหญ่มักเป็นขนสั้นๆ หรือเป็นตุ่มเล็กๆ \nราก:\nมีรากสะสมอาหารขนาดใหญ่ใต้ดิน \nดอก:\nดอกมีขนาดใหญ่ รูปถ้วย หรือรูปกรวย สีขาว เหลือง ชมพู หรือม่วง ',2,20),(30,'คลีสโตคัตตัส หนามฟู',56.50,21,6,'In stock','/products/1766411507160-598340978.png','\"คลีสโตคัตตัส หนามฟู\" เป็นชื่อเรียกของแคคตัสชนิดหนึ่งที่มีหนามละเอียดและฟูคล้ายขน หรืออาจหมายถึงแคคตัสที่มีหนามปกคลุมหนาแน่นจนดูฟู ซึ่งเป็นลักษณะที่พบได้ทั่วไปในแคคตัสหลายชนิด ตัวอย่างเช่น แคคตัสในสกุล Cleistocactus มักมีหนามยาวและหนาแน่น หรือบางชนิดอาจมีหนามที่ดูเหมือนขนปกคลุมทั่วทั้งต้น \n',2,19),(31,'กระถางน้องหมี',29.00,30,0,'In stock','/products/1771397101047-321277632.jpg','กระถางน้องหมีลายน่ารัก  มั่กๆ',4,23);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `questions`
--

DROP TABLE IF EXISTS `questions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `questions` (
  `Askid` int NOT NULL AUTO_INCREMENT,
  `Cid` int NOT NULL,
  `Asktopic` varchar(255) NOT NULL,
  `Askdetails` text NOT NULL,
  `Askimages` json DEFAULT NULL,
  `Askdate` datetime DEFAULT CURRENT_TIMESTAMP,
  `Askvisits` int DEFAULT '0',
  PRIMARY KEY (`Askid`),
  KEY `idx_Cid` (`Cid`),
  CONSTRAINT `fk_questions_user` FOREIGN KEY (`Cid`) REFERENCES `customers` (`Cid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `questions`
--

LOCK TABLES `questions` WRITE;
/*!40000 ALTER TABLE `questions` DISABLE KEYS */;
INSERT INTO `questions` VALUES (1,16,'Test','1111111',NULL,'2025-11-29 03:08:36',1),(2,16,'test','2222',NULL,'2025-11-29 03:13:49',9),(3,14,'polipo','test33',NULL,'2025-11-29 03:33:58',10),(5,17,'test1','55',NULL,'2025-11-29 04:57:26',9),(6,18,'ABC','2222',NULL,'2025-12-22 20:10:37',6),(7,5,'มีไหม','อยากได้มาก','[\"/public/forum/1771350049511-806897742.jpeg\", \"/public/forum/1771350049514-791153740.webp\"]','2026-02-18 00:40:49',12),(8,5,'สวย','อยากได้นะ','[\"/public/forum/1771351196768-798424734.jpeg\"]','2026-02-18 00:59:56',4),(9,5,'อันนี้ยังมีไหม','111','[\"/public/forum/1771355059344-796763502.png\"]','2026-02-18 02:04:19',5);
/*!40000 ALTER TABLE `questions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `replies`
--

DROP TABLE IF EXISTS `replies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `replies` (
  `Replyid` int NOT NULL AUTO_INCREMENT,
  `Askid` int NOT NULL,
  `Cid` int DEFAULT NULL,
  `Adminid` int DEFAULT NULL,
  `Replyrole` enum('user','admin') NOT NULL DEFAULT 'user',
  `Replydetails` text NOT NULL,
  `Replyimages` json DEFAULT NULL,
  `Replydate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`Replyid`),
  KEY `idx_Askid` (`Askid`),
  KEY `idx_Cid` (`Cid`),
  KEY `idx_Adminid` (`Adminid`),
  CONSTRAINT `fk_replies_admin` FOREIGN KEY (`Adminid`) REFERENCES `admin` (`Aid`) ON DELETE SET NULL,
  CONSTRAINT `fk_replies_question` FOREIGN KEY (`Askid`) REFERENCES `questions` (`Askid`) ON DELETE CASCADE,
  CONSTRAINT `fk_replies_user` FOREIGN KEY (`Cid`) REFERENCES `customers` (`Cid`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `replies`
--

LOCK TABLES `replies` WRITE;
/*!40000 ALTER TABLE `replies` DISABLE KEYS */;
INSERT INTO `replies` VALUES (1,3,5,NULL,'user','test55',NULL,'2025-11-29 03:53:58'),(2,2,5,NULL,'user','จริงป่ะจ้ะ',NULL,'2025-11-29 04:36:41'),(3,2,17,NULL,'user','จริงสิจ้ะ',NULL,'2025-11-29 04:43:45'),(5,3,18,NULL,'user','86PFH;P',NULL,'2025-12-22 20:10:49'),(6,6,12,NULL,'user','หรอ',NULL,'2026-02-03 22:16:12'),(7,9,12,NULL,'user','บ้านผมมีนะ','[\"/public/forum/1771355203415-162626012.png\"]','2026-02-18 02:06:43'),(8,9,NULL,1,'admin','มี','[\"/public/forum/1771357128444-375378973.jpg\"]','2026-02-18 02:38:48'),(9,7,NULL,1,'admin','ขอบคุณมากค่ะ',NULL,'2026-02-18 13:48:47');
/*!40000 ALTER TABLE `replies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Cid` int NOT NULL,
  `text` text NOT NULL,
  `stars` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `order_id` int DEFAULT NULL,
  `images` json DEFAULT NULL,
  `admin_reply` text,
  `replied_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_review_order` (`order_id`),
  KEY `fk_review_customer` (`Cid`),
  CONSTRAINT `fk_review_customer` FOREIGN KEY (`Cid`) REFERENCES `customers` (`Cid`) ON DELETE CASCADE,
  CONSTRAINT `fk_review_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`Oid`) ON DELETE CASCADE,
  CONSTRAINT `reviews_chk_1` CHECK ((`stars` between 1 and 5))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
INSERT INTO `reviews` VALUES (1,14,'test',5,'2025-11-29 19:07:47',NULL,'[\"/reviews/1764443267515-886562340.jpeg\", \"/reviews/1764443267517-901954792.jpg\", \"/reviews/1764443267517-957040835.webp\"]',NULL,NULL),(2,17,'test',5,'2025-11-29 19:18:16',NULL,'[\"/reviews/1764443896606-432662102.jpg\"]',NULL,NULL),(4,17,'test1111',5,'2025-11-29 20:45:28',59,'[\"/reviews/1764449128063-413386870.jpg\"]',NULL,NULL),(5,18,'ดีมั่กๆ',5,'2025-12-22 13:25:22',60,'[]',NULL,NULL),(6,14,'ยอดเยี่ยมเลยหละ',5,'2026-01-06 07:55:03',54,'[]',NULL,NULL),(7,14,'ปังมาก',4,'2026-01-12 03:20:18',51,'[]',NULL,NULL),(8,18,'ดีย์',4,'2026-02-04 09:16:13',NULL,'[]',NULL,NULL),(9,18,'เริ่ดเลยหละ',5,'2026-02-04 10:49:41',61,'[\"/reviews/1770202181938-519604767.png\", \"/reviews/1770202181940-605780769.png\"]','ขอบคุณค่ะ','2026-02-17 16:45:20'),(10,19,'เริศในเริศ',5,'2026-02-15 12:07:15',NULL,'[]','ขอบคุณมากค่ะซิส','2026-02-17 16:45:03'),(11,12,'เยี่ยมเริศ',5,'2026-02-18 06:46:59',NULL,'[\"/reviews/1771397219527-785034067.jpg\"]',NULL,NULL);
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `subtypes`
--

DROP TABLE IF EXISTS `subtypes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subtypes` (
  `Subtypeid` int NOT NULL AUTO_INCREMENT,
  `subname` varchar(100) NOT NULL,
  `Typeid` int DEFAULT NULL,
  PRIMARY KEY (`Subtypeid`),
  KEY `Typeid` (`Typeid`),
  CONSTRAINT `subtypes_ibfk_1` FOREIGN KEY (`Typeid`) REFERENCES `product_types` (`Typeid`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `subtypes`
--

LOCK TABLES `subtypes` WRITE;
/*!40000 ALTER TABLE `subtypes` DISABLE KEYS */;
INSERT INTO `subtypes` VALUES (1,'Gymnocalycium  ',1),(2,'Astrophytum   ',1),(3,'Mammillaria ',1),(4,'Lophophora   ',1),(5,'Rebutia ',1),(6,'Copiapoa ',1),(7,'Echinopsis  ',1),(14,'Ferocactus',2),(15,'Echinocactus ',2),(16,'Gymnocalycium  ',2),(17,'Mammillaria   ',2),(18,'Copiapoa    ',2),(19,'Cleistocactus     ',2),(20,'Oreocereus',2),(21,'ไม้อวบน้ำ',3),(22,'ดิน',4),(23,'กระถาง',4),(25,'อุปกรณ์เสริม',4),(26,'อื่นๆ',1),(27,'อื่นๆ',2);
/*!40000 ALTER TABLE `subtypes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transfer`
--

DROP TABLE IF EXISTS `transfer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transfer` (
  `Tid` int NOT NULL AUTO_INCREMENT,
  `Tname` varchar(100) NOT NULL,
  `Tnum` varchar(50) NOT NULL,
  `Taccount` varchar(150) NOT NULL,
  `Tbranch` varchar(100) DEFAULT NULL,
  `Tqr` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Tid`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transfer`
--

LOCK TABLES `transfer` WRITE;
/*!40000 ALTER TABLE `transfer` DISABLE KEYS */;
INSERT INTO `transfer` VALUES (1,'ธนาคารกรุงไทย','307-3-11485-8','นายสมเกียรติ สมอุ่มจาน','สาขาชัยภูมิ','/qrs/qr1.png'),(2,'ธนาคารกรุงไทย','261-3-33022-8','สมเกียรติ สมอุ่มจาน','สาขามีนบุรี','/qrs/qr2.png');
/*!40000 ALTER TABLE `transfer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'cactus_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-28 18:07:56
