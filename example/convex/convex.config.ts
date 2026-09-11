import { defineApp } from "convex/server";
import convexLivekit from "../../src/component/convex.config.js";

const app = defineApp();
app.use(convexLivekit);

export default app;
