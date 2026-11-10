import { AppShell } from "./components/AppShell";
import { Button } from "./components/ui/Button";
import { StatusBadge } from "./components/ui/StatusBadge";
import { projects } from "./data/projects";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function App() {
  return (
    <AppShell current="Projects">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <Button>New project</Button>
      </div>
      <table className="w-full overflow-hidden rounded-md border border-line bg-surface text-sm shadow-raised">
        <thead className="text-left text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className="px-4 py-2 font-medium">Project</th>
            <th scope="col" className="px-4 py-2 font-medium">Client</th>
            <th scope="col" className="px-4 py-2 font-medium">Owner</th>
            <th scope="col" className="px-4 py-2 font-medium">Status</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2 font-medium">{p.name}</td>
              <td className="px-4 py-2">{p.client}</td>
              <td className="px-4 py-2">{p.owner}</td>
              <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
              <td className="px-4 py-2 text-right tabular-nums">{date.format(new Date(p.due))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

export default App;
