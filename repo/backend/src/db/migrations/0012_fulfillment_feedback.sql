ALTER TABLE orders
  MODIFY COLUMN status ENUM('PENDING', 'CONFIRMED', 'FULFILLED', 'PICKED_UP', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS order_feedback (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  score TINYINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_feedback_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_order_feedback_order_user (order_id, user_id),
  INDEX idx_order_feedback_created (created_at)
);
