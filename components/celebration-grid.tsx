import Image from "next/image";
import { Badge } from "@/components/ui/badge";

export type CelebrationPerson = {
  id: string;
  fullName: string;
  primaryLabel: string;
  secondaryLabel?: string;
  badge?: string;
  highlight?: string | null;
  status?: "upcoming" | "completed";
  eventDate?: string;
  imageUrl?: string | null;
  previewData?: unknown;
};

type CelebrationGridProps = {
  title: string;
  subtitle?: string;
  description?: string;
  people: CelebrationPerson[];
  emptyMessage: string;
  onPersonClick?: (person: CelebrationPerson) => void;
};

const fallbackAvatar = "/avatar-placeholder.png";

export function CelebrationGrid({
  title,
  subtitle,
  description,
  people,
  emptyMessage,
  onPersonClick,
}: CelebrationGridProps) {
  const clickable = typeof onPersonClick === "function";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p>
            ) : null}
          </div>
          {description ? (
            <div className="max-w-sm rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {people.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {people.map((person) => {
            const imageSrc = person.imageUrl || fallbackAvatar;
            const statusClass =
              person.status === "completed"
                ? "border-muted-foreground/40"
                : "border-border";

            const Card = (
              <article
                className="group relative overflow-hidden rounded-2xl bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                  <Image
                    src={imageSrc}
                    alt={person.fullName}
                    fill
                    sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 25vw"
                    priority={false}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  {person.highlight ? (
                    <div className="absolute right-3 top-3">
                      <Badge
                        variant="secondary"
                        className="bg-black/65 text-xs font-semibold text-white backdrop-blur"
                      >
                        {person.highlight}
                      </Badge>
                    </div>
                  ) : null}
                  {person.badge ? (
                    <div className="absolute left-3 top-3">
                      <Badge className="bg-emerald-500/90 text-xs font-semibold text-white shadow">
                        {person.badge}
                      </Badge>
                    </div>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
                    <h3 className="text-lg font-semibold text-white drop-shadow">
                      {person.fullName}
                    </h3>
                  </div>
                </div>
                <div className="space-y-2 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">{person.primaryLabel}</p>
                  {person.secondaryLabel ? (
                    <p className="text-xs text-muted-foreground">{person.secondaryLabel}</p>
                  ) : null}
                </div>
              </article>
            );

            if (!clickable) {
              return (
                <div
                  key={person.id}
                  className={`rounded-2xl border ${statusClass}`}
                >
                  {Card}
                </div>
              );
            }

            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onPersonClick?.(person)}
                className={`rounded-2xl border ${statusClass} text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              >
                {Card}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
