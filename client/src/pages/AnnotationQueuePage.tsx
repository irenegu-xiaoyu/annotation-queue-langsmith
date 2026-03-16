import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { JsonHighlightViewer } from "../components/JsonHighlightViewer";
import {
  useCompleteQueueEntry,
  useRequeueEntry,
  useQueueNextEntry,
  useQueueRubric,
  useTraceFeedback,
  useDeleteFeedback,
  useSubmitFeedback,
} from "../hooks/useApi";
import { Rubric } from "../components/Rubric";
import type { FeedbackCreate } from "../types";

export function AnnotationQueuePage() {
  const { queueId } = useParams<{ queueId: string }>();
  const { entry, isLoading, mutate } = useQueueNextEntry(queueId || null);
  const { rubric, isLoading: isRubricLoading } = useQueueRubric(
    queueId || null,
  );
  const { trigger: submitFeedback, isMutating: isSubmittingFeedback } =
    useSubmitFeedback();
  const { trigger: completeEntry, isMutating: isCompletingEntry } =
    useCompleteQueueEntry();
  const { trigger: requeueEntry, isMutating: isRequeuingEntry } =
    useRequeueEntry();
  const shouldRequeueOnExit = useRef(true);
  const { feedback: traceFeedback, mutate: mutateTraceFeedback } =
    useTraceFeedback(entry?.trace_id ?? null);
  const { trigger: deleteFeedback, isMutating: isDeletingFeedback } =
    useDeleteFeedback();
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, { score: number | null; comment: string }>
  >({});
  const [highlightByKey, setHighlightByKey] = useState<
    Record<
      string,
      {
        source: "inputs" | "outputs";
        value: string;
        span_path: (string | number)[];
        span_start_index: number;
        span_end_index: number;
      }
    >
  >({});
  console.log("entry", entry);

  const inputData = entry?.trace.inputs ?? {};
  const outputData = entry?.trace.outputs ?? {};

  const rubrics = useMemo(
    () =>
      rubric.map((item) => ({
        title: item.feedback_key,
        description: item.description,
      })),
    [rubric],
  );

  const rubricLookup = useMemo(() => {
    return rubrics.reduce<
      Record<string, { title: string; description: string }>
    >((acc, item) => {
      acc[item.title] = item;
      return acc;
    }, {});
  }, [rubrics]);

  const findStringSpan = useCallback(
    (
      value: string,
      data: unknown,
      currentPath: (string | number)[] = [],
    ): { path: (string | number)[]; start: number; end: number } | null => {
      console.log("findStringSpan", { value, data, currentPath });
      if (typeof data === "string") {
        const index = data.indexOf(value);
        return index >= 0
          ? {
              path: currentPath,
              start: index,
              end: index + value.length,
            }
          : null;
      }

      if (Array.isArray(data)) {
        for (let index = 0; index < data.length; index += 1) {
          const childSpan = findStringSpan(value, data[index], [
            ...currentPath,
            index,
          ]);
          if (childSpan) return childSpan;
        }
      }

      if (data && typeof data === "object") {
        for (const [key, child] of Object.entries(data)) {
          const childSpan = findStringSpan(value, child, [...currentPath, key]);
          if (childSpan) return childSpan;
        }
      }

      console.warn("Selection source is not string.");
      return null;
    },
    [],
  );

  const getSelectionText = useCallback(() => {
    const raw = window.getSelection()?.toString().trim();
    if (!raw) return null;
    console.log("raw", raw);
    return raw.replace(/^['\"]|['\"]$/g, "");
  }, []);

  const handleRubricSubmit = (key: string) => {
    return (feedback: { score: number | null; comment: string }) => {
      setFeedbackByKey((prev) => ({
        ...prev,
        [key]: feedback,
      }));
    };
  };

  const handleHighlightSelect = (key: string, source: "inputs" | "outputs") => {
    const selected = getSelectionText();
    console.log("selected", selected);
    if (!selected) {
      console.warn("No JSON string selected for highlighting.");
      return;
    }

    const data = source === "inputs" ? inputData : outputData;
    const span = findStringSpan(selected, data);
    if (!span) {
      console.warn("Selected value not found in JSON data.");
      return;
    }

    setHighlightByKey((prev) => ({
      ...prev,
      [key]: {
        source,
        value: selected,
        span_path: [source, ...span.path],
        span_start_index: span.start,
        span_end_index: span.end,
      },
    }));
  };

  const handleHighlightClear = (key: string) => {
    setHighlightByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleRubricClear = async (key: string) => {
    setFeedbackByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    handleHighlightClear(key);
    if (!entry) return;

    const matches = traceFeedback.filter((item) => item.key === key);
    if (matches.length === 0) return;

    try {
      await Promise.all(
        matches.map((item) => deleteFeedback({ feedbackId: item.id })),
      );
      await mutateTraceFeedback();
    } catch (error) {
      console.error("Failed to clear feedback", error);
    }
  };

  const handleCompleteNext = async () => {
    if (!queueId || !entry) return;

    shouldRequeueOnExit.current = false;
    const feedbackKeys = new Set([
      ...Object.keys(feedbackByKey),
      ...Object.keys(highlightByKey),
    ]);

    const feedbackPayload: FeedbackCreate[] = Array.from(feedbackKeys)
      .map((key) => {
        const feedback = feedbackByKey[key];
        const highlight = highlightByKey[key];
        return {
          trace_id: entry.trace_id,
          key,
          score: feedback?.score ?? undefined,
          comment: feedback?.comment?.trim() || undefined,
          span_path: highlight?.span_path,
          span_start_index: highlight?.span_start_index,
          span_end_index: highlight?.span_end_index,
        };
      })
      .filter((payload) => {
        return (
          payload.score !== undefined ||
          (payload.comment && payload.comment.length > 0) ||
          payload.span_path !== undefined
        );
      });

    console.log("feedback payload", feedbackPayload);

    try {
      if (feedbackPayload.length > 0) {
        await submitFeedback(feedbackPayload);
      }
      console.log(queueId, entry.id);
      await completeEntry({ queueId, entryId: entry.id });
      setFeedbackByKey({});
      setHighlightByKey({});
      await mutate();
    } catch (error) {
      console.error("Failed to submit feedback", error);
    }
  };

  const handleSkipEntry = async () => {
    if (!queueId || !entry) return;

    try {
      shouldRequeueOnExit.current = false;
      if (traceFeedback.length > 0) {
        await Promise.all(
          traceFeedback.map((item) => deleteFeedback({ feedbackId: item.id })),
        );
        await mutateTraceFeedback();
      }
      await requeueEntry({ queueId, entryId: entry.id });
      setFeedbackByKey({});
      setHighlightByKey({});
      await mutate();
    } catch (error) {
      console.error("Failed to skip entry", error);
    }
  };

  useEffect(() => {
    shouldRequeueOnExit.current = true;

    return () => {
      if (!queueId || !entry) return;
      if (!shouldRequeueOnExit.current) return;

      void requeueEntry({ queueId, entryId: entry.id }).catch((error) => {
        console.error("Failed to requeue entry on exit", error);
      });
    };
  }, [entry, queueId, requeueEntry]);

  const isSubmitting =
    isSubmittingFeedback ||
    isCompletingEntry ||
    isDeletingFeedback ||
    isRequeuingEntry;

  const inputHighlights = useMemo(() => {
    return Object.entries(highlightByKey)
      .filter(([, value]) => value.source === "inputs")
      .map(([key, value]) => {
        const rubricData = rubricLookup[key] ?? {
          title: key,
          description: "",
        };
        const feedback = feedbackByKey[key];
        return {
          ...value,
          rubric_key: key,
          rubric_score: feedback?.score ?? null,
          rubric_comment: feedback?.comment ?? null,
          rubric_title: rubricData.title,
          rubric_description: rubricData.description,
        };
      });
  }, [feedbackByKey, highlightByKey, rubricLookup]);

  const outputHighlights = useMemo(() => {
    return Object.entries(highlightByKey)
      .filter(([, value]) => value.source === "outputs")
      .map(([key, value]) => {
        const rubricData = rubricLookup[key] ?? {
          title: key,
          description: "",
        };
        const feedback = feedbackByKey[key];
        return {
          ...value,
          rubric_key: key,
          rubric_score: feedback?.score ?? null,
          rubric_comment: feedback?.comment ?? null,
          rubric_title: rubricData.title,
          rubric_description: rubricData.description,
        };
      });
  }, [feedbackByKey, highlightByKey, rubricLookup]);

  if (isLoading) {
    return <div>Loading</div>;
  }

  if (!entry) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            No more entries in this queue
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            You&apos;re all caught up. Check back later or select another queue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="w-full md:w-2/3 flex flex-col">
        <div className="flex flex-row justify-between bg-white border-b border-gray-200 px-6 h-14  items-center shadow-sm">
          <h1>Annotation Queue</h1>
          <div className="flex-row">
            <button
              className="text-gray-500 m-2 text-sm/5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSkipEntry}
              disabled={isSubmitting}
            >
              Skip
            </button>
            <button
              className="rounded-sm bg-green-600 py-1 px-2 text-white text-sm/5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCompleteNext}
              disabled={isSubmitting}
            >
              Complete & Next
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <JsonHighlightViewer
            title="INPUT"
            data={inputData}
            source="inputs"
            highlights={inputHighlights}
          />
          <JsonHighlightViewer
            title="OUTPUT"
            data={outputData}
            source="outputs"
            highlights={outputHighlights}
          />
        </div>
      </div>
      <div className="flex-1 bg-white border-b border-gray-200 shadow-sm  ">
        <div className="h-20 flex flex-col justify-center shadow-sm p-4">
          <h1 className="text-lg font-semibold">Feedback Rubrics</h1>
          <p className="text-md text-gray-500">
            Select a rubric to expand and annotate.
          </p>
        </div>
        <div className="flex flex-col p-6 gap-4">
          {isRubricLoading ? (
            <p className="text-sm text-gray-500">Loading rubrics...</p>
          ) : rubrics.length > 0 ? (
            rubrics.map((rubric) => (
              <Rubric
                key={rubric.title}
                title={rubric.title}
                description={rubric.description}
                submittedScore={feedbackByKey[rubric.title]?.score ?? null}
                highlight={
                  highlightByKey[rubric.title]
                    ? {
                        source: highlightByKey[rubric.title].source,
                        value: highlightByKey[rubric.title].value,
                      }
                    : null
                }
                onHighlightSelect={(source) =>
                  handleHighlightSelect(rubric.title, source)
                }
                onHighlightClear={() => handleHighlightClear(rubric.title)}
                onSubmit={handleRubricSubmit(rubric.title)}
                onClear={() => handleRubricClear(rubric.title)}
              />
            ))
          ) : (
            <p className="text-sm text-gray-500">No rubrics available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
