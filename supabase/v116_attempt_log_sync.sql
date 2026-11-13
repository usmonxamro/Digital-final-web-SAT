-- v116: attempt_log (web rows) fell behind test_attempts whenever an answer key was fixed and attempts were re-scored.
-- One-time repair: copy the re-scored result back into the log. From v116 the re-scoring code does this itself.
update attempt_log l
set correct = t.correct_count,
    score_text = case when l.score_text is null then null else t.composite::text end,
    wrong_qids = coalesce(
      (select array_agg(e->>'questionId') from jsonb_array_elements(t.review_json) e
        where (e->>'correct') = 'false' and e->>'questionId' is not null),
      '{}'::text[])
from test_attempts t
where l.web_attempt_id = t.id and l.source = 'web' and jsonb_typeof(t.review_json) = 'array';
