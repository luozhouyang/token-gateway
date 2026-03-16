import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1>Token Gateway Desktop</h1>
      <p>API Proxy Engine GUI</p>

      <div style={{ marginTop: "40px" }}>
        <h2>状态</h2>
        <div id="status">未连接</div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={() => console.log("Start proxy")}
          style={{ marginRight: "10px", padding: "10px 20px" }}
        >
          启动
        </button>
        <button onClick={() => console.log("Stop proxy")} style={{ padding: "10px 20px" }}>
          停止
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
