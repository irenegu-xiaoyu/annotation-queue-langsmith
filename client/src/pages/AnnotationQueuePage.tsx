import { useState } from "react";
import { useParams } from "react-router-dom";
import JsonView from "@uiw/react-json-view";
import {
  useCompleteQueueEntry,
  useQueue,
  useQueueNextEntry,
  useQueueRubric,
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
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, { score: number | null; comment: string }>
  >({});
  console.log("entry", entry);

  if (!entry) {
    return <div>Entry not found</div>;
  }

  if (isLoading) {
    return <div>Loading</div>;
  }

  const inputData = entry.trace.inputs;
  const outputData = entry.trace.outputs;

  const rubrics = rubric.map((item) => ({
    title: item.feedback_key,
    description: item.description,
  }));

  const handleRubricSubmit = (key: string) => {
    return (feedback: { score: number | null; comment: string }) => {
      setFeedbackByKey((prev) => ({
        ...prev,
        [key]: feedback,
      }));
    };
  };

  const handleCompleteNext = async () => {
    if (!queueId || !entry) return;

    const feedbackPayload: FeedbackCreate[] = Object.entries(feedbackByKey)
      .filter(([, feedback]) => {
        return feedback.score !== null || feedback.comment.trim().length > 0;
      })
      .map(([key, feedback]) => ({
        trace_id: entry.trace_id,
        key,
        score: feedback.score ?? undefined,
        comment: feedback.comment.trim() || undefined,
      }));

    console.log("feedback payload", feedbackPayload);

    try {
      if (feedbackPayload.length > 0) {
        await submitFeedback(feedbackPayload);
      }
      console.log(queueId, entry.id);
      await completeEntry({ queueId, entryId: entry.id });
      setFeedbackByKey({});
      await mutate();
    } catch (error) {
      console.error("Failed to submit feedback", error);
    }
  };

  const isSubmitting = isSubmittingFeedback || isCompletingEntry;

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="w-full md:w-2/3 flex flex-col">
        <div className="flex flex-row justify-between bg-white border-b border-gray-200 px-6 h-14  items-center shadow-sm">
          <h1>Annotation Queue</h1>
          <div className="flex-row">
            <button className="text-gray-500 m-2 text-sm/5">Skip</button>
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
          <div>
            <h2 className="text-gray-600">INPUT</h2>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <JsonView value={inputData} collapsed={1} />
            </div>
          </div>
          <div>
            <h2 className="text-gray-600">OUTPUT</h2>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <JsonView value={outputData} collapsed={1} />
            </div>
          </div>
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
                onSubmit={handleRubricSubmit(rubric.title)}
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
