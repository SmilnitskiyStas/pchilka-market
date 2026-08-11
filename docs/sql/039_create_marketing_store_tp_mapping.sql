CREATE TABLE IF NOT EXISTS marketing_store_tp_mapping (
  tp_code INT NOT NULL,
  store_label VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tp_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO marketing_store_tp_mapping (tp_code, store_label) VALUES
(2,'М2'),(3,'М3'),(5,'М5'),(6,'М6'),(7,'М7'),(8,'М8'),(10,'М10'),(12,'М12'),(14,'М14'),(15,'М15'),(16,'М16'),(19,'М19'),(20,'М20'),(21,'М21'),(22,'М22'),(23,'М23'),(25,'М4/1'),(26,'М26'),(28,'М28'),(29,'М13/1'),(30,'М32'),(31,'М33'),(32,'М25'),(33,'М37'),(34,'М36'),(35,'М29'),(38,'М30'),(39,'М27'),(40,'М39'),(41,'М38'),(43,'М24/1'),(44,'М35'),(45,'М1/1'),(46,'М40'),(48,'М43'),(49,'М42'),(50,'М11/1'),(51,'М41'),(52,'М17/1'),(54,'М9/1'),(55,'М31')
ON DUPLICATE KEY UPDATE store_label=VALUES(store_label), is_active=1;
