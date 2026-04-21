import { useEffect, useState } from "react";
import { api } from "../api";

type Office = { name: string; icon: string };
type Service = { name: string; offices: Office[] };
type Data = { topLevelOffices: Office[]; services: Service[] };

export default function Offices() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api.get("/api/offices-data")
      .then((d) => setData(d));
  }, []);
  return (
    <div style={{ padding: 24 }}>
      <h1>Offices & Services</h1>
      <h2>Top-level Offices</h2>
      <ul>
        {data?.topLevelOffices.map((o) => (
          <li key={o.name}>{o.name}</li>
        ))}
      </ul>
      <h2>Services</h2>
      {data?.services.map((s) => (
        <div key={s.name} style={{ marginBottom: 12 }}>
          <h3>{s.name}</h3>
          <ul>
            {s.offices.map((o) => (
              <li key={o.name}>{o.name}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
