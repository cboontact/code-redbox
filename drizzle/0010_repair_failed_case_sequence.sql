-- Failed submissions advanced the counter before the case transaction completed.
-- Re-align it once with the highest case that actually exists; subsequent case
-- creation continues to use the atomic counter in the application.
UPDATE case_sequences
SET last_value = COALESCE((
  SELECT MAX(CAST(substr(c.case_number, 9) AS INTEGER))
  FROM cases c
  WHERE c.case_number LIKE 'RB-' || case_sequences.year || '-%'
), 0)
WHERE last_value > COALESCE((
  SELECT MAX(CAST(substr(c.case_number, 9) AS INTEGER))
  FROM cases c
  WHERE c.case_number LIKE 'RB-' || case_sequences.year || '-%'
), 0);
