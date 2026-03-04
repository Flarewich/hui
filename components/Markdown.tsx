import ReactMarkdown from "react-markdown";

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-content prose prose-invert max-w-none prose-headings:tracking-wide prose-a:text-cyan-300">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
