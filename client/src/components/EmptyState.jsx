export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <h2 className="h5 mb-2">{title}</h2>
      <p className="text-muted mb-3">{children}</p>
      {action}
    </div>
  );
}
