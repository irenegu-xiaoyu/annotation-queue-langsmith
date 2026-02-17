import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";

type RubricProps = {
  title: string;
  description: string;
  submittedScore: number | null;
  highlight: { source: "inputs" | "outputs"; value: string } | null;
  onHighlightSelect: (source: "inputs" | "outputs") => void;
  onHighlightClear: () => void;
  onSubmit: (feedback: { score: number | null; comment: string }) => void;
  onClear: () => void;
};

export function Rubric({
  title,
  description,
  submittedScore,
  highlight,
  onHighlightSelect,
  onHighlightClear,
  onSubmit,
  onClear,
}: RubricProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericScore = score === "" ? null : Number(score);
    onSubmit({
      score: Number.isNaN(numericScore) ? null : numericScore,
      comment,
    });
    setIsExpanded(false);
  };

  const handleClear = () => {
    setScore("");
    setComment("");
    onHighlightClear();
    onClear();
  };

  const formattedScore =
    submittedScore !== null ? submittedScore.toFixed(1) : null;

  return (
    <div>
      <div className="flex flex-col border rounded-md border-gray-300">
        <button
          type="button"
          className="flex items-center justify-between p-3 text-left"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          <div>
            <h2 className="text-md font-semibold">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
            {formattedScore !== null ? (
              <div className="mt-2">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Score: {formattedScore}
                </span>
              </div>
            ) : null}
          </div>
          <ChevronRight
            className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
              isExpanded ? "rotate-90" : "rotate-0"
            }`}
          />
        </button>
        {isExpanded ? (
          <div className="border-t border-gray-200 px-3 pb-3 pt-3">
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                <span className="font-medium text-gray-700">
                  Highlight a JSON string (optional)
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-white"
                    onClick={() => onHighlightSelect("inputs")}
                  >
                    Use selection from Input
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-white"
                    onClick={() => onHighlightSelect("outputs")}
                  >
                    Use selection from Output
                  </button>
                  {highlight ? (
                    <button
                      type="button"
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-white"
                      onClick={onHighlightClear}
                    >
                      Clear highlight
                    </button>
                  ) : null}
                </div>
                {highlight ? (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-800">
                    <span className="font-semibold">Highlighted</span> (
                    {highlight.source}):
                    <span className="ml-1 break-all">{highlight.value}</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">
                    Select a JSON string value in the viewer, then choose Input
                    or Output.
                  </span>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-medium">Score (0.0 - 1.0)</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  placeholder="eg 0.8"
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-medium">Comment</span>
                <textarea
                  rows={4}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Submit Feedback
                </button>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={handleClear}
                >
                  Clear Feedback
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
