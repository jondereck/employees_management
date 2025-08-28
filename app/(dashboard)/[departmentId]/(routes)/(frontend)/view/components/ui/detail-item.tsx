interface DetailItemProps {
  label: string;
  value: React.ReactNode;
}

export const DetailItem = ({ label, value }: DetailItemProps) => (
  <div className="mb-1">
    <h3 className="text-xs sm:text-sm text-muted-foreground">{label}</h3>
    <p className="text-sm sm:text-base font-medium text-gray-900">{value}</p>
  </div>
);
