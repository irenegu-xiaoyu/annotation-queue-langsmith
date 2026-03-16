"""Business logic for feedback."""

import json
from uuid import UUID

import asyncpg

from src import schemas
from src.sql_utils import prepare_query


async def create_feedback_batch(
    conn: asyncpg.Connection,
    feedback_batch: list[schemas.FeedbackCreate],
) -> list[dict]:
    """Create multiple feedback items at once."""
    if not feedback_batch:
        return None  # Signal empty batch error

    # Validate all trace_ids exist
    trace_ids = {fb.trace_id for fb in feedback_batch}
    query, params = prepare_query(
        """
        SELECT id FROM traces
        WHERE id = ANY($trace_ids::uuid[])
        """,
        trace_ids=list(trace_ids),
    )
    traces = await conn.fetch(query, *params)
    found_trace_ids = {row["id"] for row in traces}
    missing_trace_ids = trace_ids - found_trace_ids
    if missing_trace_ids:
        return None, missing_trace_ids  # Signal missing traces

    # Prepare batch insert data
    insert_values = []
    for feedback in feedback_batch:
        span_path = json.dumps(feedback.span_path) if feedback.span_path is not None else None
        insert_values.append(
            (
                feedback.trace_id,
                feedback.key,
                feedback.score,
                feedback.comment,
                span_path,
                feedback.span_start_index,
                feedback.span_end_index,
            )
        )

    # Insert all feedback items in batch
    rows = await conn.fetch(
        """
        INSERT INTO feedback (
            trace_id,
            key,
            score,
            comment,
            span_path,
            span_start_index,
            span_end_index
        )
        SELECT * FROM UNNEST(
            $1::uuid[],
            $2::text[],
            $3::float[],
            $4::text[],
            $5::jsonb[],
            $6::int[],
            $7::int[]
        )
        ON CONFLICT (trace_id, key)
        DO UPDATE SET
            score = EXCLUDED.score,
            comment = EXCLUDED.comment,
            span_path = EXCLUDED.span_path,
            span_start_index = EXCLUDED.span_start_index,
            span_end_index = EXCLUDED.span_end_index,
            modified_at = NOW()
        RETURNING
            id,
            trace_id,
            key,
            score,
            comment,
            span_path,
            span_start_index,
            span_end_index,
            created_at,
            modified_at
        """,
        [v[0] for v in insert_values],  # trace_ids
        [v[1] for v in insert_values],  # keys
        [v[2] for v in insert_values],  # scores
        [v[3] for v in insert_values],  # comments
        [v[4] for v in insert_values],  # span_path
        [v[5] for v in insert_values],  # span_start_index
        [v[6] for v in insert_values],  # span_end_index
    )

    # Process results
    results = []
    for row in rows:
        result = dict(row)
        if isinstance(result.get("span_path"), str):
            result["span_path"] = json.loads(result["span_path"])
        results.append(result)
    return results


async def update_feedback(
    conn: asyncpg.Connection,
    feedback_id: UUID,
    feedback_update: schemas.FeedbackUpdate,
) -> dict | None:
    """Update a feedback item."""
    # Build dynamic update query with named params
    updates = {}

    if feedback_update.score is not None:
        updates["score"] = feedback_update.score

    if feedback_update.comment is not None:
        updates["comment"] = feedback_update.comment

    if feedback_update.span_path is not None:
        updates["span_path"] = feedback_update.span_path

    if feedback_update.span_start_index is not None:
        updates["span_start_index"] = feedback_update.span_start_index

    if feedback_update.span_end_index is not None:
        updates["span_end_index"] = feedback_update.span_end_index

    if not updates:
        return None  # Signal no fields to update

    # Build SET clause with named parameters
    set_clauses = []
    for field in updates.keys():
        set_clauses.append(f"{field} = ${field}")
    set_clauses.append("modified_at = NOW()")

    query_str = f"""
        UPDATE feedback
        SET {", ".join(set_clauses)}
        WHERE id = $feedback_id
        RETURNING
            id,
            trace_id,
            key,
            score,
            comment,
            span_path,
            span_start_index,
            span_end_index,
            created_at,
            modified_at
    """

    # Remove modified_at from params since we handle it with NOW()
    params_dict = dict(updates)
    params_dict["feedback_id"] = feedback_id

    query, params = prepare_query(query_str, **params_dict)
    row = await conn.fetchrow(query, *params)
    if not row:
        return False  # Signal not found

    result = dict(row)
    if isinstance(result.get("span_path"), str):
        result["span_path"] = json.loads(result["span_path"])
    return result


async def get_feedback(conn: asyncpg.Connection, feedback_id: UUID) -> dict | None:
    """Fetch a feedback item by ID."""
    query, params = prepare_query(
        """
        SELECT
            id,
            trace_id,
            key,
            score,
            comment,
            span_path,
            span_start_index,
            span_end_index,
            created_at,
            modified_at
        FROM feedback
        WHERE id = $feedback_id
        """,
        feedback_id=feedback_id,
    )
    row = await conn.fetchrow(query, *params)
    if not row:
        return None

    result = dict(row)
    if isinstance(result.get("span_path"), str):
        result["span_path"] = json.loads(result["span_path"])
    return result


async def delete_feedback(conn: asyncpg.Connection, feedback_id: UUID) -> bool:
    """Delete a feedback item. Returns True if deleted, False if not found."""
    query, params = prepare_query(
        """
        DELETE FROM feedback
        WHERE id = $feedback_id
        """,
        feedback_id=feedback_id,
    )
    result = await conn.execute(query, *params)
    return result != "DELETE 0"
