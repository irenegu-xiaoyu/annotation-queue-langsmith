import { useCallback } from "react";
import JsonView from "@uiw/react-json-view";

export type JsonHighlight = {
  source: "inputs" | "outputs";
  span_path: (string | number)[];
  span_start_index: number;
  span_end_index: number;
  rubric_key: string;
  rubric_score: number | null;
  rubric_comment: string | null;
  rubric_title: string;
  rubric_description: string;
};

type JsonHighlightViewerProps = {
  title: string;
  data: unknown;
  source: "inputs" | "outputs";
  highlights: JsonHighlight[];
};

export function JsonHighlightViewer({
  title,
  data,
  source,
  highlights,
}: JsonHighlightViewerProps) {
  const isSamePath = useCallback(
    (left: (string | number)[], right: (string | number)[]) => {
      if (left.length !== right.length) return false;
      return left.every((value, index) => value === right[index]);
    },
    [],
  );

  const getHighlightsForPath = useCallback(
    (keys?: (string | number)[]) => {
      const resolvedKeys = keys ?? [];
      return highlights
        .filter((entry) => {
          if (entry.source !== source) return false;
          const path = entry.span_path.slice(1);
          return isSamePath(path, resolvedKeys);
        })
        .sort((left, right) => left.span_start_index - right.span_start_index);
    },
    [highlights, isSamePath, source],
  );

  const renderHighlightedString = useCallback(
    (
      _props: unknown,
      context: {
        type: "value" | "type";
        value?: unknown;
        keyName: string | number;
        keys?: (string | number)[];
      },
    ) => {
      if (context.type !== "value" || typeof context.value !== "string") {
        return null;
      }

      const text = context.value;

      const matches = getHighlightsForPath(context.keys).filter((entry) => {
        return (
          entry.span_start_index < entry.span_end_index &&
          entry.span_start_index < text.length
        );
      });
      if (matches.length === 0) return null;

      const boundaries = Array.from(
        new Set(
          matches.flatMap((highlight) => [
            Math.max(0, highlight.span_start_index),
            Math.min(text.length, highlight.span_end_index),
          ]),
        ),
      )
        .filter((point) => point >= 0 && point <= text.length)
        .sort((a, b) => a - b);

      if (boundaries.length === 0) return null;

      if (boundaries[0] !== 0) {
        boundaries.unshift(0);
      }
      if (boundaries[boundaries.length - 1] !== text.length) {
        boundaries.push(text.length);
      }

      const segments: React.ReactNode[] = [];

      for (let index = 0; index < boundaries.length - 1; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        if (start === end) continue;

        const segmentText = text.slice(start, end);
        const activeHighlights = matches.filter(
          (highlight) =>
            highlight.span_start_index <= start &&
            highlight.span_end_index >= end,
        );

        if (activeHighlights.length === 0) {
          segments.push(segmentText);
          continue;
        }

        const boxShadow = activeHighlights
          .map(
            (_, layerIndex) =>
              `0 0 0 ${layerIndex + 1}px rgba(251, 191, 36, 0.6)`,
          )
          .join(", ");

        segments.push(
          <span
            key={`segment-${start}-${end}`}
            className="group relative inline-flex"
            style={{ boxShadow }}
          >
            <span className="rounded-sm bg-yellow-200 px-0.5">
              {segmentText}
            </span>
            <span className="pointer-events-none absolute left-1/2 top-[-0.6rem] z-10 w-64 -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
              {activeHighlights.map((highlight, highlightIndex) => (
                <span
                  key={`${highlight.rubric_key}-${highlightIndex}`}
                  className="mb-1 block last:mb-0"
                >
                  <span className="block font-semibold">
                    {highlight.rubric_key}
                  </span>
                  <span className="block text-gray-200">
                    Score: {highlight.rubric_score ?? "—"}
                  </span>
                  <span className="block text-gray-200">
                    {highlight.rubric_comment
                      ? `Comment: ${highlight.rubric_comment}`
                      : "Comment: —"}
                  </span>
                </span>
              ))}
            </span>
          </span>,
        );
      }

      return <span className="w-rjv-value">"{segments}"</span>;
    },
    [getHighlightsForPath],
  );

  return (
    <div>
      <h2 className="text-gray-600">{title}</h2>
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm [&_.w-rjv-line]:select-none [&_.w-rjv-value]:select-text">
        <JsonView
          value={data as object}
          collapsed={1}
          displayDataTypes={false}
          displayObjectSize={false}
          shortenTextAfterLength={0}
        >
          <JsonView.String render={renderHighlightedString} />
        </JsonView>
      </div>
    </div>
  );
}
