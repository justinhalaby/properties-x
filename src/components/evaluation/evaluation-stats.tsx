interface EvaluationStatsProps {
  total: number;
}

export function EvaluationStats({ total }: EvaluationStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">Total Records</p>
        <p className="text-2xl font-bold">{total.toLocaleString()}</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">Data Source</p>
        <p className="text-lg font-semibold">Montreal Evaluation Roll</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">Coverage</p>
        <p className="text-lg font-semibold">All Property Types</p>
      </div>
    </div>
  );
}
