async function getIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    console.log("IPv4 address:", data.ip);
  } catch (err) {
    console.error("IPv4 fetch failed:", err);
  }
  try {
    const res = await fetch("https://api64.ipify.org?format=json");
    const data = await res.json();
    console.log("IPv6 address:", data.ip);
  } catch (err) {
    console.error("IPv6 fetch failed:", err);
  }
}
getIP();
