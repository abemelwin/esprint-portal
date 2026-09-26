/**
 * Scheduler layout — the (portal)/layout only provides auth check now.
 * The scheduler manages its own scrolling via SchedulerClient.
 */
export default function SchedulerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {children}
    </div>
  );
}
