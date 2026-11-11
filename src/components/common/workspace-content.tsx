import StatCard from "./stat-card";

export default function WorkspaceContent({
  cards,
  sections,
}: {
  cards: { title: string; value: string; description?: string }[];
  sections: { title: string; description: string }[];
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <div className="card" key={section.title}>
            <h2 className="text-lg font-bold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {section.description}
            </p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Connect this page to the Spring Boot API to display live system data.
        Do not use sample figures as real hospital records.
      </div>
    </div>
  );
}
