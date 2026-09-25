import { onRequestGet as __api_ws_js_onRequestGet } from "C:\\Users\\练\\Documents\\xwechat_files\\wxid_qylyxq7cdwoq22_4164\\msg\\file\\2026-09\\桔子好声音_部署版\\functions\\api\\ws.js"

export const routes = [
    {
      routePath: "/api/ws",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_ws_js_onRequestGet],
    },
  ]