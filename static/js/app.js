function refreshPage() {
  location.reload();
}

async function apiGetList(path = "/") {
  const res = await fetch(`/api/list?path=${path}`);
  return await res.json();
}

function toast(msg, ok = true) {
  const color = ok ? "green" : "red";
  const div = document.createElement("div");
  div.style = `position:fixed;top:20px;right:20px;background:${color};color:white;padding:10px;border-radius:5px;`;
  div.innerText = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
  const isCollapsed = sidebar.classList.contains("collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");
}

document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  if (localStorage.getItem("sidebarCollapsed") === "1") {
    sidebar.classList.add("collapsed");
  }
});