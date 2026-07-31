interface StaticPageRendererProps {
  title: string;
  body: string;
  updatedAt?: Date | string | null;
}

function isHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body.trim().slice(0, 300));
}

export function StaticPageRenderer({ title, body, updatedAt }: StaticPageRendererProps) {
  return (
    <article className="mx-auto max-w-2xl px-3 py-6">
      <header className="mb-4 border-b border-border pb-3">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
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

      {isHtml(body) ? (
        <div
          className="static-page-body"
          dangerouslySetInnerHTML={{ __html: body }}
          style={{
            fontSize: '0.875rem',
            lineHeight: '1.7',
            color: 'inherit',
          }}
        />
      ) : (
        <div className="space-y-3">
          {body.split(/\n{2,}/).map((block, idx) => {
            const lines = block.split('\n');
            const isList = lines.every(l => l.trim().startsWith('- '));
            if (isList) {
              return (
                <ul key={idx} className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  {lines.map((l, j) => <li key={j}>{l.replace(/^\s*-\s+/, '')}</li>)}
                </ul>
              );
            }
            if (lines.length === 1 && lines[0].length < 80) {
              return <h2 key={idx} className="mt-5 text-base font-bold text-foreground">{lines[0]}</h2>;
            }
            return (
              <p key={idx} className="text-sm leading-relaxed text-muted-foreground">
                {lines.map((l, j) => <span key={j}>{l}{j < lines.length - 1 && <br />}</span>)}
              </p>
            );
          })}
        </div>
      )}

      <style>{`
        .static-page-body h2 {
          font-size: 1.05rem;
          font-weight: 700;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
          color: var(--foreground, inherit);
        }
        .static-page-body h3 {
          font-size: 0.9rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.35rem;
          color: var(--foreground, inherit);
        }
        .static-page-body p {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          color: var(--muted-foreground, #6b7280);
        }
        .static-page-body ul, .static-page-body ol {
          margin: 0.5rem 0 0.5rem 1.5rem;
          color: var(--muted-foreground, #6b7280);
        }
        .static-page-body ul { list-style-type: disc; }
        .static-page-body ol { list-style-type: decimal; }
        .static-page-body li { margin-bottom: 0.25rem; }
        .static-page-body a {
          color: var(--primary, #3b82f6);
          text-decoration: underline;
        }
        .static-page-body strong {
          font-weight: 600;
          color: var(--foreground, inherit);
        }
        .static-page-body code {
          font-size: 0.8em;
          background: var(--muted, #f3f4f6);
          padding: 0.1em 0.3em;
          border-radius: 3px;
        }
        .static-page-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.8rem;
        }
        .static-page-body th, .static-page-body td {
          border: 1px solid var(--border, #e5e7eb);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .static-page-body th {
          background: var(--muted, #f3f4f6);
          font-weight: 600;
          color: var(--foreground, inherit);
        }
        .static-page-body td {
          color: var(--muted-foreground, #6b7280);
        }
        .static-page-body div[style*="background"] {
          border-radius: 4px;
        }
      `}</style>
    </article>
  );
}
