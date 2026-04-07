ALTER TABLE pickup_windows
  ADD CONSTRAINT chk_pickup_window_1h_duration
    CHECK (TIMEDIFF(end_time, start_time) = '01:00:00');
