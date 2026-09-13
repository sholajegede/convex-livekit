import { useState } from "react";
import { Header, type Tab } from "./components/Header";
import { TopBanner } from "./components/TopBanner";
import { RoomsPanel } from "./components/RoomsPanel";
import { JoinPanel } from "./components/JoinPanel";
import { WebhooksPanel } from "./components/WebhooksPanel";
import { History } from "./components/History";
import { Console } from "./components/Console";
import "./theme.css";

export default function App() {
  const [tab, setTab] = useState<Tab>("rooms");

  return (
    <div className="shell">
      <div className={`main${tab === "join" ? " wide" : ""}`}>
        <Header tab={tab} onTab={setTab} />
        <TopBanner />
        {tab === "rooms" && <RoomsPanel />}
        {tab === "join" && <JoinPanel />}
        {tab === "webhooks" && <WebhooksPanel />}
        {tab === "history" && <History />}
      </div>
      <Console />
    </div>
  );
}
