import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, detail, icon }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-green">{icon}</span>}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-ink">{value}</p>
      {detail && <p className="mt-3 text-xs text-muted">{detail}</p>}
    </Card>
  );
}
