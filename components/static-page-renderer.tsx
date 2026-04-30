interface StaticPageRendererProps {
  title: string;
  body: string;
  updatedAt?: Date | string | null;
}

function renderBody(body: string): React.ReactNode {
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, idx) => {
    const lines = block.split('\n');
    const isList = lines.every((l) => l.trim().startsWith('- '));
    if (isList) {
      return (
        <ul key={idx} className="my-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
          {lines.map((l, j) => (
            <li key={j}>{l.replace(/^\s*-\s+/, '')}</li>
          ))}
        </ul>
      );
    }
    if (lines.length === 1 && /^[A-Z][^.!?]*$/.test(lines[0]) && lines[0].length < 80) {
      return (
        <h2 key={idx} className="mt-4 text-sm font-semibold text-foreground">
          {lines[0]}
        </h2>
      );
    }
    return (
      <p key={idx} className="my-2 text-xs leading-relaxed text-muted-foreground">
        {lines.map((l, j) => (
          <span key={j}>
            {l}
            {j < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

export function StaticPageRenderer({ title, body, updatedAt }: StaticPageRendererProps) {
  return (
    <article className="mx-auto max-w-2xl px-3 py-6">
      <header className="mb-4 border-b border-border pb-3">
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {updatedAt && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Last updated{' '}
            {new Date(updatedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
      </header>
      <div className="prose-sm">{renderBody(body)}</div>
    </article>
  );
}
