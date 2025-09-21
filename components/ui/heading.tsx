// components/ui/heading.tsx
import * as React from "react";

interface HeadingProps {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
}

const Heading = ({ title, description }: HeadingProps) => {
  return (
    <div>
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      {description != null && (
        <div className="text-sm text-muted-foreground mt-1">
          {description}
        </div>
      )}
    </div>
  );
};

export default Heading;
